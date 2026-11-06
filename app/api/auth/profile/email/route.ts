import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { authenticateRequest, hashLoginCode, normalizeEmail, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmailChangeVerificationCode } from "@/lib/email";

export const runtime = "nodejs";

const RESEND_COOLDOWN_MS = 60_000;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; currentPassword?: unknown };
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
  if (!email || (body.currentPassword !== undefined && typeof body.currentPassword !== "string")) {
    return NextResponse.json({ error: "Provide a valid email address and current password if your account has one." }, { status: 400 });
  }

  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const accountResult = await db.query<{ password_hash: string | null; email: string }>(
      "SELECT password_hash, email FROM users WHERE id = $1",
      [user.id],
    );
    const account = accountResult.rows[0];
    if (!account || (account.password_hash && (
      typeof body.currentPassword !== "string" ||
      !(await verifyPassword(body.currentPassword, account.password_hash))
    ))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    if (email === account.email) {
      return NextResponse.json({ error: "That is already your email address." }, { status: 400 });
    }
    const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    let client: PoolClient;
    try {
      client = await db.connect();
    } catch (error) {
      console.error("Unable to connect for email change:", error);
      return NextResponse.json({ error: "Unable to start email verification." }, { status: 500 });
    }

    const id = randomUUID();
    const code = randomInt(100_000, 1_000_000).toString();
    let recentChallengeId: string | undefined;
    try {
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);
      const recentResult = await client.query<{ id: string; created_at: Date }>(
        `SELECT id, created_at
         FROM email_change_codes
         WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id],
      );
      const recent = recentResult.rows[0];
      if (recent && Date.now() - recent.created_at.getTime() < RESEND_COOLDOWN_MS) {
        recentChallengeId = recent.id;
        await client.query("COMMIT");
      } else {
        await client.query(
          "UPDATE email_change_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL",
          [user.id],
        );
        await client.query(
          `INSERT INTO email_change_codes (id, user_id, new_email, code_hash, expires_at)
           VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')`,
          [id, user.id, email, hashLoginCode(id, code)],
        );
        await client.query("COMMIT");
      }
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    if (recentChallengeId) {
      return NextResponse.json({
        requiresVerification: true,
        challengeId: recentChallengeId,
        message: "A verification code was sent recently. Check your inbox or wait before resending.",
      });
    }

    try {
      await sendEmailChangeVerificationCode(email, code);
    } catch (error) {
      await db.query("DELETE FROM email_change_codes WHERE id = $1", [id]);
      console.error("Email change verification send failed:", error);
      return NextResponse.json({ error: "Unable to send a verification code. Check your email settings and try again." }, { status: 503 });
    }

    return NextResponse.json({ requiresVerification: true, challengeId: id });
  } catch (error) {
    console.error("Email change request failed:", error);
    return NextResponse.json({ error: "Unable to start email verification." }, { status: 500 });
  }
}
