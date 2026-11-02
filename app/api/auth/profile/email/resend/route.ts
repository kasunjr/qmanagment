import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { authenticateRequest, hashLoginCode } from "@/lib/auth";
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
    return NextResponse.json({ error: "The email change request is invalid or expired." }, { status: 401 });
  }

  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let client: PoolClient;
    try {
      client = await db.connect();
    } catch (error) {
      console.error("Unable to connect to resend email change code:", error);
      return NextResponse.json({ error: "Unable to resend the verification code." }, { status: 500 });
    }

    let nextChallenge: { id: string; email: string; code: string } | undefined;
    let tooSoon = false;
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const result = await client.query<{
        id: string;
        user_id: string;
        new_email: string;
        created_at: Date;
        expires_at: Date;
        consumed_at: Date | null;
        attempts: number;
      }>(
        `SELECT id, user_id, new_email, created_at, expires_at, consumed_at, attempts
         FROM email_change_codes
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [body.challengeId, user.id],
      );
      const challenge = result.rows[0];
      if (!challenge || challenge.consumed_at || challenge.expires_at.getTime() <= Date.now()) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "The email change request is invalid or expired." }, { status: 401 });
      }
      if (Date.now() - challenge.created_at.getTime() < RESEND_COOLDOWN_MS) {
        tooSoon = true;
        await client.query("COMMIT");
      } else {
        const id = randomUUID();
        const code = randomInt(100_000, 1_000_000).toString();
        await client.query("UPDATE email_change_codes SET consumed_at = NOW() WHERE id = $1", [challenge.id]);
        await client.query(
          `INSERT INTO email_change_codes (id, user_id, new_email, code_hash, expires_at)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
          [id, user.id, challenge.new_email, hashLoginCode(id, code)],
        );
        await client.query("COMMIT");
        nextChallenge = { id, email: challenge.new_email, code };
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("Email change code resend failed:", error);
      return NextResponse.json({ error: "Unable to resend the verification code." }, { status: 500 });
    } finally {
      client.release();
    }

    if (tooSoon) {
      return NextResponse.json({ error: "Please wait a minute before requesting another code." }, { status: 429 });
    }
    if (!nextChallenge) {
      return NextResponse.json({ error: "Unable to resend the verification code." }, { status: 500 });
    }

    try {
      await sendSignupVerificationCode(nextChallenge.email, nextChallenge.code);
      return NextResponse.json({ challengeId: nextChallenge.id });
    } catch (error) {
      console.error("Unable to send email change verification code:", error);
      return NextResponse.json({
        challengeId: nextChallenge.id,
        error: "Unable to send the verification email. Check the email configuration and try again.",
      }, { status: 503 });
    }
  } catch (error) {
    console.error("Email change code resend failed:", error);
    return NextResponse.json({ error: "Unable to resend the verification code." }, { status: 500 });
  }
}
