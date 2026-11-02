import { randomInt, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { hashLoginCode, hashPassword, isValidPassword, normalizeEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendSignupVerificationCode } from "@/lib/email";

export const runtime = "nodejs";

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
  if (!email || !isValidPassword(body.password)) {
    return NextResponse.json(
      { error: "Provide a valid email and a password of 12-72 UTF-8 bytes." },
      { status: 400 },
    );
  }

  let client: PoolClient;
  try {
    client = await db.connect();
  } catch (error) {
    console.error("Unable to connect for signup:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }

  const codeId = randomUUID();
  const code = randomInt(100_000, 1_000_000).toString();
  let user: { id: string; email: string; role: "user" | "admin"; tenant_code: string } | undefined;

  try {
    const passwordHash = await hashPassword(body.password);
    await client.query("BEGIN");
    const result = await client.query<{ id: string; email: string; role: "user" | "admin"; tenant_code: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING RETURNING id, email, role, tenant_code`,
      [email, passwordHash],
    );
    user = result.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    await client.query(
      `INSERT INTO signup_email_codes (id, user_id, code_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
      [codeId, user.id, hashLoginCode(codeId, code)],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Signup failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  } finally {
    client.release();
  }

  try {
    await sendSignupVerificationCode(email, code);
    return NextResponse.json({ requiresVerification: true, verificationType: "signup", challengeId: codeId }, { status: 201 });
  } catch (error) {
    console.error("Signup verification email failed:", error);
    return NextResponse.json({
      requiresVerification: true,
      verificationType: "signup",
      challengeId: codeId,
      error: "Account created, but the verification email could not be sent. Check the email configuration and try again.",
    }, { status: 503 });
  }
}
