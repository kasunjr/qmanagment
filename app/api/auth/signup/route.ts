import { NextRequest, NextResponse } from "next/server";
import { createSession, hashPassword, isValidPassword, normalizeEmail, setAccessCookie, setRefreshCookie } from "@/lib/auth";
import { db } from "@/lib/db";

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

  try {
    const passwordHash = await hashPassword(body.password);
    let user: { id: string; email: string; role: "user" | "admin"; tenant_code: string } | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const result = await db.query<{ id: string; email: string; role: "user" | "admin"; tenant_code: string }>(
          `INSERT INTO users (email, password_hash) VALUES ($1, $2)
           ON CONFLICT (email) DO NOTHING RETURNING id, email, role, tenant_code`,
          [email, passwordHash],
        );
        user = result.rows[0];
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== "23505" || attempt === 4) throw error;
      }
    }
    if (!user) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const session = await createSession(user);
    const response = NextResponse.json({ user, accessToken: session.accessToken }, { status: 201 });
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    return response;
  } catch (error) {
    console.error("Signup failed:", error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}