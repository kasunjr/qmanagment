import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchColumns, validateBranchFields, type BranchRecord } from "@/lib/branches";
import { DEFAULT_QUEUE_NAME } from "@/lib/queues";
import { isUniqueViolation } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const result = await db.query<BranchRecord>(
      `SELECT ${branchColumns} FROM branches
       WHERE tenant_code = $1 ORDER BY created_at DESC, id`,
      [user.tenant_code],
    );
    return NextResponse.json({ branches: result.rows });
  } catch (error) {
    console.error("Branches retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve branches." }, { status: 500 });
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

    const validation = validateBranchFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    // The branch and its default queue are created in one statement so a branch never exists without one.
    const { name, code } = validation.fields;
    const result = await db.query<BranchRecord>(
      `WITH branch AS (
         INSERT INTO branches (tenant_code, name, code)
         VALUES ($1, $2, $3)
         RETURNING ${branchColumns}
       ), default_queue AS (
         INSERT INTO queues (tenant_code, branch_id, name, is_default)
         SELECT tenant_code, id, $4, TRUE FROM branch
       )
       SELECT ${branchColumns} FROM branch`,
      [user.tenant_code, name, code, DEFAULT_QUEUE_NAME],
    );
    return NextResponse.json({ branch: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Branch code is already used in this tenant." }, { status: 409 });
    }
    console.error("Branch creation failed:", error);
    return NextResponse.json({ error: "Unable to create branch." }, { status: 500 });
  }
}
