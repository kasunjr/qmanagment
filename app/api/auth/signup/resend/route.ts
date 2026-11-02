import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { hashLoginCode } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSignupVerificationCode } from "@/lib/email";

export const runtime = "nodejs";

const CHALLENGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  let body: { challengeId?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body.challengeId !== "string" || !CHALLENGE_ID_PATTERN.test(body.challengeId)) {
    return NextResponse.json({ error: "The signup request is invalid or expired." }, { status: 401 });
  }

  let client: PoolClient;
  try {
    client = await db.connect();
  } catch (error) {
    console.error("Unable to connect to resend signup verification code:", error);
    return NextResponse.json({ error: "Unable to send a verification code." }, { status: 500 });
  }

  let nextChallenge: { id: string; email: string; code: string } | undefined;
  let tooSoon = false;
  let alreadyVerified = false;

  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      user_id: string;
      created_at: Date;
      consumed_at: Date | null;
      email_verified_at: Date | null;
      email: string;
    }>(
      `SELECT c.id, c.user_id, c.created_at, c.consumed_at, u.email_verified_at, u.email
       FROM signup_email_codes c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1
       FOR UPDATE OF c, u`,
      [body.challengeId],
    );
    const challenge = result.rows[0];
    if (!challenge || challenge.consumed_at) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "The signup request is invalid or expired." }, { status: 401 });
    }

    if (challenge.email_verified_at) {
      alreadyVerified = true;
      await client.query("COMMIT");
    } else if (Date.now() - challenge.created_at.getTime() < RESEND_COOLDOWN_MS) {
      tooSoon = true;
      await client.query("COMMIT");
    } else {
      const id = randomUUID();
      const code = randomInt(100_000, 1_000_000).toString();
      await client.query("UPDATE signup_email_codes SET consumed_at = NOW() WHERE id = $1", [challenge.id]);
      await client.query(
        `INSERT INTO signup_email_codes (id, user_id, code_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
        [id, challenge.user_id, hashLoginCode(id, code)],
      );
      await client.query("COMMIT");
      nextChallenge = { id, email: challenge.email, code };
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Signup verification code resend failed:", error);
    return NextResponse.json({ error: "Unable to send a verification code." }, { status: 500 });
  } finally {
    client.release();
  }

  if (alreadyVerified) {
    return NextResponse.json({ error: "This email address is already verified. Please sign in." }, { status: 409 });
  }
  if (tooSoon) {
    return NextResponse.json({ error: "Please wait a minute before requesting another code." }, { status: 429 });
  }
  if (!nextChallenge) {
    return NextResponse.json({ error: "Unable to send a verification code." }, { status: 500 });
  }

  try {
    await sendSignupVerificationCode(nextChallenge.email, nextChallenge.code);
    return NextResponse.json({ challengeId: nextChallenge.id });
  } catch (error) {
    console.error("Unable to resend signup verification email:", error);
    return NextResponse.json({
      challengeId: nextChallenge.id,
      error: "Unable to send the verification email. Check the email configuration and try again later.",
    }, { status: 503 });
  }
}
