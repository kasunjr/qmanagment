import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword, isValidPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isValidPassword(body.newPassword)) {
    return NextResponse.json({ error: "New password must be 12-72 UTF-8 bytes." }, { status: 400 });
  }
  if (body.currentPassword !== undefined && typeof body.currentPassword !== "string") {
    return NextResponse.json({ error: "Current password must be a string." }, { status: 400 });
  }

  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const result = await db.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id],
    );
    const passwordHash = result.rows[0]?.password_hash;
    if (passwordHash && (
      typeof body.currentPassword !== "string" ||
      !(await verifyPassword(body.currentPassword, passwordHash))
    )) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    if (passwordHash && await verifyPassword(body.newPassword, passwordHash)) {
      return NextResponse.json({ error: "Choose a new password different from your current password." }, { status: 400 });
    }

    const nextPasswordHash = await hashPassword(body.newPassword);
    await db.query(
      "UPDATE users SET password_hash = $2, password_changed_at = NOW(), updated_at = NOW() WHERE id = $1",
      [user.id, nextPasswordHash],
    );
    await db.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
      [user.id],
    );

    return NextResponse.json({ message: "Password updated. Sign in again with your new password." });
  } catch (error) {
    console.error("Password update failed:", error);
    return NextResponse.json({ error: "Unable to update password." }, { status: 500 });
  }
}
