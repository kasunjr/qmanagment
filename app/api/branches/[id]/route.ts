import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  branchColumns,
  validateBranchFields,
  type BranchFields,
  type BranchRecord,
} from "@/lib/branches";
import { isUniqueViolation, isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid branch ID." }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateBranchFields(body, true);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const fields: BranchFields = validation.fields;
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [field, value] of Object.entries(fields)) {
      values.push(value);
      assignments.push(`${field} = $${values.length}`);
    }
    values.push(params.id, user.tenant_code);

    const result = await db.query<BranchRecord>(
      `UPDATE branches SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND tenant_code = $${values.length}
       RETURNING ${branchColumns}`,
      values,
    );
    const branch = result.rows[0];
    if (!branch) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ branch });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Branch code is already used in this tenant." }, { status: 409 });
    }
    console.error("Branch update failed:", error);
    return NextResponse.json({ error: "Unable to update branch." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid branch ID." }, { status: 400 });

    // Cascades to the branch's queues and service assignments.
    const result = await db.query<{ id: string }>(
      "DELETE FROM branches WHERE id = $1 AND tenant_code = $2 RETURNING id",
      [params.id, user.tenant_code],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Branch deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete branch." }, { status: 500 });
  }
}
