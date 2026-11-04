import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkStaffAssignment,
  isForeignKeyViolation,
  isUniqueViolation,
  isUuid,
  replaceStaffUserServices,
  staffUserColumns,
  staffUserColumnsWithServices,
  validateStaffUserFields,
  type StaffUserFields,
  type StaffUserRecord,
} from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid staff user ID." }, { status: 400 });

    const result = await db.query<StaffUserRecord>(
      `SELECT ${staffUserColumnsWithServices} FROM staff_users
       WHERE id = $1 AND tenant_code = $2`,
      [params.id, user.tenant_code],
    );
    const staffUser = result.rows[0];
    if (!staffUser) return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    return NextResponse.json({ staffUser });
  } catch (error) {
    console.error("Staff user retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve staff user." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid staff user ID." }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateStaffUserFields(body, true);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const { service_ids, ...fields }: StaffUserFields = validation.fields;
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [field, value] of Object.entries(fields)) {
      const column = field === "code" ? "code_hash" : field;
      values.push(field === "code" ? await hashPassword(value!) : value);
      assignments.push(`${column} = $${values.length}`);
    }
    values.push(params.id, user.tenant_code);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const assignmentError = await checkStaffAssignment(client, user.tenant_code, fields.branch_id, service_ids);
      if (assignmentError) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: assignmentError }, { status: 400 });
      }

      const result = await client.query<StaffUserRecord>(
        `UPDATE staff_users SET ${assignments.length ? `${assignments.join(", ")}, ` : ""}updated_at = NOW()
         WHERE id = $${values.length - 1} AND tenant_code = $${values.length}
         RETURNING ${staffUserColumns}`,
        values,
      );
      const staffUser = result.rows[0];
      if (!staffUser) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
      }

      if (service_ids !== undefined) {
        await replaceStaffUserServices(client, params.id, service_ids);
      }

      const updatedResult = await client.query<StaffUserRecord>(
        `SELECT ${staffUserColumnsWithServices} FROM staff_users WHERE id = $1`,
        [params.id],
      );
      await client.query("COMMIT");
      return NextResponse.json({ staffUser: updatedResult.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    // The branch or a service was deleted while the request was in flight.
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "Branch or service not found." }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Username or email is already used in this tenant." }, { status: 409 });
    }
    console.error("Staff user update failed:", error);
    return NextResponse.json({ error: "Unable to update staff user." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid staff user ID." }, { status: 400 });

    const result = await db.query<{ id: string }>(
      "DELETE FROM staff_users WHERE id = $1 AND tenant_code = $2 RETURNING id",
      [params.id, user.tenant_code],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Staff user deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete staff user." }, { status: 500 });
  }
}
