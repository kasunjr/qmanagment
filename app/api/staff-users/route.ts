import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isStaffQueueAssignmentConflict,
  isUniqueViolation,
  staffUserColumns,
  staffUserColumnsWithQueue,
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
      `SELECT ${staffUserColumnsWithQueue} FROM staff_users
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

    const { name, username, email, role, code, queue_id = null } = validation.fields;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (queue_id) {
        const queueResult = await client.query<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM queues WHERE tenant_code = $1 AND id = $2",
          [user.tenant_code, queue_id],
        );
        if (Number(queueResult.rows[0].count) !== 1) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Queue was not found in this tenant." }, { status: 400 });
        }
        const assignedResult = await client.query(
          "SELECT 1 FROM staff_user_queues WHERE queue_id = $1 LIMIT 1",
          [queue_id],
        );
        if (assignedResult.rowCount) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "This queue is already assigned to another staff user." }, { status: 409 });
        }
      }

      const result = await client.query<StaffUserRecord>(
        `INSERT INTO staff_users (tenant_code, name, username, email, role, code_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${staffUserColumns}`,
        [user.tenant_code, name, username, email, role, await hashPassword(code!)],
      );
      const staffUser = result.rows[0];
      if (queue_id) {
        await client.query(
          `INSERT INTO staff_user_queues (tenant_code, staff_user_id, queue_id)
           VALUES ($1, $2, $3)`,
          [user.tenant_code, staffUser.id, queue_id],
        );
      }
      await client.query("COMMIT");
      return NextResponse.json({ staffUser: { ...staffUser, queue_id } }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (isStaffQueueAssignmentConflict(error)) {
      return NextResponse.json({ error: "This queue is already assigned to another staff user." }, { status: 409 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Username or email is already used in this tenant." }, { status: 409 });
    }
    console.error("Staff user creation failed:", error);
    return NextResponse.json({ error: "Unable to create staff user." }, { status: 500 });
  }
}
