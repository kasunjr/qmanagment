import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendStaffWelcomeEmail } from "@/lib/email";
import { assertWithinPlanLimit, PlanLimitError, planLimitResponse } from "@/lib/plans";
import {
  checkStaffAssignment,
  isForeignKeyViolation,
  isUniqueViolation,
  replaceStaffUserServices,
  staffUserColumns,
  staffUserColumnsWithServices,
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
      `SELECT ${staffUserColumnsWithServices} FROM staff_users
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

    const {
      name, username, email, code,
      walk_in_enabled = false,
      branch_id = null, counter_name = null, service_ids = [],
    } = validation.fields;
    // Hashed before the transaction so the plan-limit lock is not held during bcrypt.
    const codeHash = await hashPassword(code!);
    const client = await db.connect();
    let createdStaffUser: StaffUserRecord;
    try {
      await client.query("BEGIN");
      await assertWithinPlanLimit(client, user.tenant_code, "staff_users");
      const assignmentError = await checkStaffAssignment(client, user.tenant_code, branch_id, service_ids);
      if (assignmentError) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: assignmentError }, { status: 400 });
      }

      const result = await client.query<StaffUserRecord>(
        `INSERT INTO staff_users (tenant_code, name, username, email, code_hash, walk_in_enabled, branch_id, counter_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${staffUserColumns}`,
        [user.tenant_code, name, username, email, codeHash, walk_in_enabled, branch_id, counter_name],
      );
      const staffUser = result.rows[0];
      await replaceStaffUserServices(client, staffUser.id, service_ids);
      await client.query("COMMIT");
      createdStaffUser = { ...staffUser, service_ids };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }

    let welcomeEmailSent = false;
    try {
      await sendStaffWelcomeEmail(createdStaffUser);
      welcomeEmailSent = true;
    } catch {
      console.error("Staff welcome email delivery failed for staff user:", createdStaffUser.id);
    }
    return NextResponse.json({
      staffUser: createdStaffUser,
      welcomeEmailSent,
      ...(!welcomeEmailSent && { warning: "Staff user created, but the welcome email could not be sent. Share the staff counter link and username with them. Do not create the user again." }),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanLimitError) return planLimitResponse(error);
    // The branch or a service was deleted while the request was in flight.
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "Branch or service not found." }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Username or email is already used in this tenant." }, { status: 409 });
    }
    console.error("Staff user creation failed:", error);
    return NextResponse.json({ error: "Unable to create staff user." }, { status: 500 });
  }
}
