import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isUniqueViolation,
  isUuid,
  staffUserColumns,
  staffUserColumnsWithQueues,
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
      `SELECT ${staffUserColumnsWithQueues} FROM staff_users
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

    const { queue_ids, ...fields }: StaffUserFields = validation.fields;
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
      if (queue_ids !== undefined && queue_ids.length) {
        const queueResult = await client.query<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM queues WHERE tenant_code = $1 AND id = ANY($2::uuid[])",
          [user.tenant_code, queue_ids],
        );
        if (Number(queueResult.rows[0].count) !== queue_ids.length) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "One or more queues were not found in this tenant." }, { status: 400 });
        }
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

      if (queue_ids !== undefined) {
        await client.query("DELETE FROM staff_user_queues WHERE staff_user_id = $1", [params.id]);
        if (queue_ids.length) {
          await client.query(
            `INSERT INTO staff_user_queues (tenant_code, staff_user_id, queue_id)
             SELECT $1, $2, unnest($3::uuid[])`,
            [user.tenant_code, params.id, queue_ids],
          );
        }
      }

      const queueResult = await client.query<{ queue_ids: string[] }>(
        `SELECT COALESCE(array_agg(queue_id ORDER BY queue_id), '{}') AS queue_ids
         FROM staff_user_queues WHERE staff_user_id = $1`,
        [params.id],
      );
      await client.query("COMMIT");
      return NextResponse.json({ staffUser: { ...staffUser, queue_ids: queueResult.rows[0].queue_ids } });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
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
