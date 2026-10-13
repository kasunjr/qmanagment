import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createStaffAccessToken, setStaffAuthCookies, verifyStaffCode } from "@/lib/staff-auth";
import { staffUserColumnsWithQueue, type StaffUserRecord } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StaffLoginRecord extends StaffUserRecord {
  code_hash: string;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.tenant_code !== "string" ||
    !/^[A-F0-9]{7}$/i.test(input.tenant_code.trim()) ||
    typeof input.username !== "string" ||
    !/^[a-zA-Z0-9._-]{3,64}$/.test(input.username.trim()) ||
    typeof input.code !== "string" ||
    Buffer.byteLength(input.code, "utf8") < 4 ||
    Buffer.byteLength(input.code, "utf8") > 72
  ) {
    return NextResponse.json({ error: "Tenant code, username, or staff code is invalid." }, { status: 400 });
  }

  try {
    const tenantCode = input.tenant_code.trim().toUpperCase();
    const username = input.username.trim().toLowerCase();
    const result = await db.query<StaffLoginRecord>(
      `SELECT ${staffUserColumnsWithQueue}, code_hash FROM staff_users
       WHERE tenant_code = $1 AND username = $2`,
      [tenantCode, username],
    );
    const staff = result.rows[0];
    if (!staff || !(await verifyStaffCode(input.code, staff.code_hash))) {
      return NextResponse.json({ error: "Tenant code, username, or staff code is incorrect." }, { status: 401 });
    }

    const { code_hash: _codeHash, ...staffUser } = staff;
    const accessToken = await createStaffAccessToken(staff);
    const response = NextResponse.json({ staffUser });
    setStaffAuthCookies(response, accessToken, tenantCode);
    return response;
  } catch (error) {
    console.error("Staff login failed:", error);
    return NextResponse.json({ error: "Unable to log in staff user." }, { status: 500 });
  }
}
