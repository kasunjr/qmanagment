import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isUniqueViolation,
  staffUserColumns,
  validateStaffUserFields,
  type StaffUserRecord,
} from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const result = await db.query<StaffUserRecord>(
      `SELECT ${staffUserColumns} FROM staff_users
       WHERE tenant_code = $1 ORDER BY created_at DESC, id`,
      [user.tenant_code],
    );
    return NextResponse.json({ staffUsers: result.rows });
  } catch (error) {
    console.error("Staff users retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve staff users." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateStaffUserFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const { name, username, email, role, code } = validation.fields;
    const result = await db.query<StaffUserRecord>(
      `INSERT INTO staff_users (tenant_code, name, username, email, role, code_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${staffUserColumns}`,
      [user.tenant_code, name, username, email, role, await hashPassword(code!)],
    );
    return NextResponse.json({ staffUser: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Username or email is already used in this tenant." }, { status: 409 });
    }
    console.error("Staff user creation failed:", error);
    return NextResponse.json({ error: "Unable to create staff user." }, { status: 500 });
  }
}
