import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { authenticateRequest, verifyLoginCode } from "@/lib/auth";
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

  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let client: PoolClient;
    try {
      client = await db.connect();
    } catch (error) {
      console.error("Unable to connect for email change verification:", error);
      return NextResponse.json({ error: "Unable to verify the email change." }, { status: 500 });
    }

    let updatedEmail: string | undefined;
    let invalidCode = false;
    let attemptsExceeded = false;
    let emailInUse = false;
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const result = await client.query<{
        id: string;
        new_email: string;
        code_hash: string;
        expires_at: Date;
        consumed_at: Date | null;
        attempts: number;
      }>(
        `SELECT id, new_email, code_hash, expires_at, consumed_at, attempts
         FROM email_change_codes
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [body.challengeId, user.id],
      );
      const challenge = result.rows[0];
      if (!challenge || challenge.consumed_at || challenge.expires_at.getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
      }
      if (challenge.attempts >= 5) {
        attemptsExceeded = true;
        await client.query("COMMIT");
      } else if (!verifyLoginCode(challenge.id, body.code, challenge.code_hash)) {
        invalidCode = true;
        await client.query("UPDATE email_change_codes SET attempts = attempts + 1 WHERE id = $1", [challenge.id]);
        await client.query("COMMIT");
      } else {
        try {
          await client.query(
            `UPDATE users
             SET email = $2, email_verified_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [user.id, challenge.new_email],
          );
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            emailInUse = true;
            await client.query("ROLLBACK");
          } else {
            throw error;
          }
        }
        if (!emailInUse) {
          await client.query("UPDATE email_change_codes SET consumed_at = NOW() WHERE id = $1", [challenge.id]);
          await client.query("UPDATE email_change_codes SET consumed_at = NOW() WHERE user_id = $1 AND id <> $2 AND consumed_at IS NULL", [user.id, challenge.id]);
          await client.query("UPDATE login_email_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL", [user.id]);
          await client.query("COMMIT");
          updatedEmail = challenge.new_email;
        }
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Email change verification failed:", error);
      return NextResponse.json({ error: "Unable to verify the email change." }, { status: 500 });
    } finally {
      client.release();
    }

    if (emailInUse) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }
    if (attemptsExceeded) {
      return NextResponse.json({ error: "Too many incorrect codes. Request a new code and try again." }, { status: 429 });
    }
    if (invalidCode || !updatedEmail) {
      return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 401 });
    }

    return NextResponse.json({ email: updatedEmail, emailVerified: true });
  } catch (error) {
    console.error("Email change verification request failed:", error);
    return NextResponse.json({ error: "Unable to verify the email change." }, { status: 500 });
  }
}
