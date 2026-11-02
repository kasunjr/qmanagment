import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { createSession, setAccessCookie, setRefreshCookie, verifyLoginCode } from "@/lib/auth";
import { db } from "@/lib/db";

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
    console.error("Unable to connect for login verification:", error);
    return NextResponse.json({ error: "Unable to verify the login code." }, { status: 500 });
  }
  let user: { id: string; email: string; role: "user" | "admin"; tenant_code: string } | undefined;
  let invalidCode = false;
  let expiredOrInvalid = false;
  let attemptsExceeded = false;

  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      user_id: string;
      code_hash: string;
      expires_at: Date;
      consumed_at: Date | null;
      attempts: number;
      email: string;
      role: "user" | "admin";
      tenant_code: string;
    }>(
      `SELECT c.id, c.user_id, c.code_hash, c.expires_at, c.consumed_at, c.attempts,
              u.email, u.role, u.tenant_code
       FROM login_email_codes c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [body.challengeId],
    );
    const challenge = result.rows[0];

    if (!challenge || challenge.consumed_at || challenge.expires_at.getTime() <= Date.now()) {
      expiredOrInvalid = true;
      await client.query("ROLLBACK");
    } else if (challenge.attempts >= 5) {
      attemptsExceeded = true;
      await client.query("COMMIT");
    } else if (!verifyLoginCode(challenge.id, body.code, challenge.code_hash)) {
      invalidCode = true;
      await client.query("UPDATE login_email_codes SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
      await client.query("COMMIT");
    } else {
      await client.query("UPDATE login_email_codes SET consumed_at = NOW() WHERE id = $1", [challenge.id]);
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
    console.error("Login code verification failed:", error);
    return NextResponse.json({ error: "Unable to verify the login code." }, { status: 500 });
  } finally {
    client.release();
  }

  if (attemptsExceeded) {
    return NextResponse.json({ error: "Too many incorrect codes. Start signing in again." }, { status: 429 });
  }
  if (expiredOrInvalid || invalidCode || !user) {
    return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
  }

  try {
    const session = await createSession(user);
    const response = NextResponse.json({ user, accessToken: session.accessToken });
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    return response;
  } catch (error) {
    console.error("Login verification succeeded but session creation failed:", error);
    return NextResponse.json({ error: "Unable to complete login. Please sign in again." }, { status: 500 });
  }
}
