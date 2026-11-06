import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  hashLoginCode,
  setAccessCookie,
  setRefreshCookie,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";

export const runtime = "nodejs";

const STATE_COOKIE = "qms_google_state";
const VERIFIER_COOKIE = "qms_google_verifier";
const NEXT_COOKIE = "qms_google_next";
const COOKIE_PATH = "/api/auth/google";
const RESEND_COOLDOWN_MS = 60_000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
  };
}

function clearOAuthCookies(response: NextResponse): void {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, NEXT_COOKIE]) {
    response.cookies.set(name, "", { ...cookieOptions(), maxAge: 0 });
  }
}

function oauthError(request: NextRequest, error = "google"): NextResponse {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  clearOAuthCookies(response);
  return response;
}

function safeNextPath(value: string | undefined, baseUrl: string): string {
  if (!value) return "/admin";
  try {
    const destination = new URL(value, baseUrl);
    if (destination.origin === new URL(baseUrl).origin) {
      return `${destination.pathname}${destination.search}${destination.hash}`;
    }
  } catch {
    return "/admin";
  }
  return "/admin";
}

function statesMatch(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
}

export async function GET(request: NextRequest) {
  const state = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  if (!statesMatch(state, request.nextUrl.searchParams.get("state")) || !verifier) {
    return oauthError(request);
  }
  if (request.nextUrl.searchParams.has("error")) return oauthError(request);

  const code = request.nextUrl.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!code || !clientId || !clientSecret || !redirectUri) {
    return oauthError(request, "google_configuration");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });
    const tokenResult: unknown = await tokenResponse.json();
    if (
      !tokenResponse.ok ||
      !tokenResult ||
      typeof tokenResult !== "object" ||
      !("access_token" in tokenResult) ||
      typeof tokenResult.access_token !== "string"
    ) {
      console.error("Google OAuth token exchange failed with status:", tokenResponse.status);
      return oauthError(request);
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenResult.access_token}` },
      cache: "no-store",
    });
    const profile: unknown = await profileResponse.json();
    if (
      !profileResponse.ok ||
      !profile ||
      typeof profile !== "object" ||
      !("sub" in profile) ||
      typeof profile.sub !== "string" ||
      !("email" in profile) ||
      typeof profile.email !== "string" ||
      !("email_verified" in profile) ||
      profile.email_verified !== true
    ) {
      console.error("Google OAuth returned an invalid or unverified profile with status:", profileResponse.status);
      return oauthError(request);
    }

    const googleProfile: GoogleProfile = {
      sub: profile.sub,
      email: profile.email,
      ...("name" in profile && typeof profile.name === "string" ? { name: profile.name } : {}),
    };
    const email = googleProfile.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return oauthError(request);
    }

    const client = await db.connect();
    let user: {
      id: string;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
      two_step_enabled: boolean;
    } | undefined;
    try {
      await client.query("BEGIN");
      const existingResult = await client.query<{
        id: string;
        email: string;
        role: "user" | "admin";
        tenant_code: string;
        google_sub: string | null;
        two_step_enabled: boolean;
      }>(
        `SELECT id, email, role, tenant_code, google_sub, two_step_enabled
         FROM users
         WHERE google_sub = $1 OR email = $2
         ORDER BY (google_sub = $1) DESC
         LIMIT 1
         FOR UPDATE`,
        [googleProfile.sub, email],
      );
      const existing = existingResult.rows[0];
      if (existing) {
        if (existing.google_sub && existing.google_sub !== googleProfile.sub) {
          await client.query("ROLLBACK");
          return oauthError(request);
        }
        const linked = await client.query(
          `UPDATE users
           SET google_sub = $2,
               email_verified_at = COALESCE(email_verified_at, NOW()),
               display_name = CASE
                 WHEN display_name = '' AND $3 <> '' THEN $3
                 ELSE display_name
               END,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, email, role, tenant_code, two_step_enabled`,
          [existing.id, googleProfile.sub, googleProfile.name?.trim().slice(0, 100) ?? ""],
        );
        user = linked.rows[0];
      } else {
        const created = await client.query(
          `INSERT INTO users (email, password_hash, google_sub, display_name, email_verified_at)
           VALUES ($1, NULL, $2, $3, NOW())
           RETURNING id, email, role, tenant_code, two_step_enabled`,
          [email, googleProfile.sub, googleProfile.name?.trim().slice(0, 100) ?? ""],
        );
        user = created.rows[0];
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    if (!user) return oauthError(request);
    const nextPath = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value, request.url);
    if (user.two_step_enabled) {
      const challengeId = randomUUID();
      const emailCode = randomInt(100_000, 1_000_000).toString();
      const client = await db.connect();
      let activeChallengeId: string = challengeId;
      let codeToSend: string | undefined;
      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
        const recentResult = await client.query<{ id: string; created_at: Date }>(
          `SELECT id, created_at
           FROM login_email_codes
           WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [user.id],
        );
        const recent = recentResult.rows[0];
        if (recent && Date.now() - recent.created_at.getTime() < RESEND_COOLDOWN_MS) {
          activeChallengeId = recent.id;
        } else {
          await client.query(
            "UPDATE login_email_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL",
            [user.id],
          );
          await client.query("DELETE FROM login_email_codes WHERE expires_at < NOW()");
          await client.query(
            `INSERT INTO login_email_codes (id, user_id, code_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
            [challengeId, user.id, hashLoginCode(challengeId, emailCode)],
          );
          codeToSend = emailCode;
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      if (codeToSend) {
        try {
          await sendLoginCode(user.email, codeToSend);
        } catch (error) {
          await db.query("DELETE FROM login_email_codes WHERE id = $1", [activeChallengeId]);
          throw error;
        }
      }
      const destination = new URL("/login", request.url);
      destination.searchParams.set("google_challenge", activeChallengeId);
      destination.searchParams.set("next", nextPath);
      const response = NextResponse.redirect(destination);
      clearOAuthCookies(response);
      return response;
    }

    const authUser = { id: user.id, email: user.email, role: user.role, tenant_code: user.tenant_code };
    const session = await createSession(authUser);
    const response = NextResponse.redirect(new URL(nextPath, request.url));
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    clearOAuthCookies(response);
    return response;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    return oauthError(request);
  }
}
