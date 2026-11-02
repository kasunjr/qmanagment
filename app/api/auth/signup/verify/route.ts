import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { createSession, verifyLoginCode, setAccessCookie, setRefreshCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";

export const runtime = "nodejs";

const CHALLENGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { challengeId?: unknown; code?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    typeof body.challengeId !== "string" ||
    !CHALLENGE_ID_PATTERN.test(body.challengeId) ||
    typeof body.code !== "string" ||
    !/^\d{6}$/.test(body.code)
  ) {
    return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
  }

  let client: PoolClient;
  try {
    client = await db.connect();
  } catch (error) {
    console.error("Unable to connect for signup verification:", error);
    return NextResponse.json({ error: "Unable to verify the signup code." }, { status: 500 });
  }

  let user: { id: string; email: string; role: "user" | "admin"; tenant_code: string } | undefined;
  let attemptsExceeded = false;
  let invalidCode = false;

  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      user_id: string;
      code_hash: string;
      expires_at: Date;
      consumed_at: Date | null;
      attempts: number;
      email_verified_at: Date | null;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
    }>(
      `SELECT c.id, c.user_id, c.code_hash, c.expires_at, c.consumed_at, c.attempts,
              u.email_verified_at, u.email, u.role, u.tenant_code
       FROM signup_email_codes c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1
       FOR UPDATE OF c, u`,
      [body.challengeId],
    );
    const challenge = result.rows[0];

    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.email_verified_at ||
      challenge.expires_at.getTime() <= Date.now()
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
    }

    if (challenge.attempts >= 5) {
      attemptsExceeded = true;
      await client.query("COMMIT");
    } else if (!verifyLoginCode(challenge.id, body.code, challenge.code_hash)) {
      invalidCode = true;
      await client.query("UPDATE signup_email_codes SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
      await client.query("COMMIT");
    } else {
      await client.query("UPDATE signup_email_codes SET consumed_at = NOW() WHERE id = $1", [challenge.id]);
      await client.query("UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1", [challenge.user_id]);
      await client.query("COMMIT");
      user = {
        id: challenge.user_id,
        email: challenge.email,
        role: challenge.role,
        tenant_code: challenge.tenant_code,
      };
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Signup code verification failed:", error);
    return NextResponse.json({ error: "Unable to verify the signup code." }, { status: 500 });
  } finally {
    client.release();
  }

  if (attemptsExceeded) {
    return NextResponse.json({ error: "Too many incorrect codes. Request a new code and try again." }, { status: 429 });
  }
  if (invalidCode || !user) {
    return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
  }

  let welcomeEmailSent = true;
  try {
    await sendWelcomeEmail(user.email);
  } catch (error) {
    welcomeEmailSent = false;
    console.error("Welcome email failed after signup verification:", error);
  }

  try {
    const session = await createSession(user);
    const response = NextResponse.json({ user, accessToken: session.accessToken, welcomeEmailSent });
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    return response;
  } catch (error) {
    console.error("Email verified but signup session creation failed:", error);
    return NextResponse.json({ error: "Email verified, but unable to complete sign-in. Please log in." }, { status: 500 });
  }
}
