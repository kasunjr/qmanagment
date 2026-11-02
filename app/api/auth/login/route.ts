import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  hashLoginCode,
  normalizeEmail,
  setAccessCookie,
  setRefreshCookie,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { sendLoginCode, sendSignupVerificationCode } from "@/lib/email";

export const runtime = "nodejs";

const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email || typeof body.password !== "string") {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  try {
    const result = await db.query<{
      id: string;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
      password_hash: string;
      email_verified_at: Date | null;
      two_step_enabled: boolean;
    }>(
      "SELECT id, email, role, tenant_code, password_hash, email_verified_at, two_step_enabled FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    if (!user.email_verified_at) {
      const challengeId = randomUUID();
      const code = randomInt(100_000, 1_000_000).toString();
      const client = await db.connect();
      let existingChallengeId: string | undefined;

      try {
        await client.query("BEGIN");
        await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
        const recentCode = await client.query<{ id: string; created_at: Date }>(
          `SELECT id, created_at
           FROM signup_email_codes
           WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [user.id],
        );
        const recent = recentCode.rows[0];
        if (recent && Date.now() - recent.created_at.getTime() < RESEND_COOLDOWN_MS) {
          existingChallengeId = recent.id;
          await client.query("COMMIT");
        } else {
          await client.query(
            "UPDATE signup_email_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL",
            [user.id],
          );
          await client.query(
            `INSERT INTO signup_email_codes (id, user_id, code_hash, expires_at)
             VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
            [challengeId, user.id, hashLoginCode(challengeId, code)],
          );
          await client.query("COMMIT");
        }
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      if (existingChallengeId) {
        return NextResponse.json({
          requiresVerification: true,
          verificationType: "signup",
          challengeId: existingChallengeId,
        });
      }

      try {
        await sendSignupVerificationCode(user.email, code);
      } catch (error) {
        console.error("Email verification resend from login failed:", error);
        return NextResponse.json({
          requiresVerification: true,
          verificationType: "signup",
          challengeId,
          error: "Unable to send the verification email. Wait a minute and use Resend code to try again.",
        }, { status: 503 });
      }

      return NextResponse.json({
        requiresVerification: true,
        verificationType: "signup",
        challengeId,
      });
    }

    if (!user.two_step_enabled) {
      const authUser = { id: user.id, email: user.email, role: user.role, tenant_code: user.tenant_code };
      const session = await createSession(authUser);
      const response = NextResponse.json({ user: authUser, accessToken: session.accessToken });
      setRefreshCookie(response, session.refreshToken);
      setAccessCookie(response, session.accessToken);
      return response;
    }

    const challengeId = randomUUID();
    const code = randomInt(100_000, 1_000_000).toString();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const recentCode = await client.query<{ created_at: Date }>(
        `SELECT created_at
         FROM login_email_codes
         WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id],
      );
      if (recentCode.rows[0] && Date.now() - recentCode.rows[0].created_at.getTime() < RESEND_COOLDOWN_MS) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "A login code was sent recently. Please wait a minute before trying again." }, { status: 429 });
      }

      await client.query("UPDATE login_email_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL", [user.id]);
      await client.query("DELETE FROM login_email_codes WHERE expires_at < NOW()");
      await client.query(
        `INSERT INTO login_email_codes (id, user_id, code_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [challengeId, user.id, hashLoginCode(challengeId, code)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    try {
      await sendLoginCode(user.email, code);
    } catch (error) {
      await db.query("DELETE FROM login_email_codes WHERE id = $1", [challengeId]);
      throw error;
    }

    return NextResponse.json({ requiresVerification: true, verificationType: "login", challengeId });
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to log in." }, { status: 500 });
  }
}