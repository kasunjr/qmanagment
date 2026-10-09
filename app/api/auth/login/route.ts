import { NextRequest, NextResponse } from "next/server";
import { createSession, normalizeEmail, setAccessCookie, setRefreshCookie, verifyPassword } from "@/lib/auth";
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
    }>(
      "SELECT id, email, role, tenant_code, password_hash FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    const authUser = { id: user.id, email: user.email, role: user.role, tenant_code: user.tenant_code };
    const session = await createSession(authUser);
    const response = NextResponse.json({
      user: authUser,
      accessToken: session.accessToken,
    });
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Unable to log in." }, { status: 500 });
  }
}