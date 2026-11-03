import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { branchColumns, validateBranchFields, type BranchRecord } from "@/lib/branches";
import { PlanLimitError, planLimitResponse, withPlanLimit } from "@/lib/plans";
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

    // A new branch has no queues; the admin creates them and adds services.
    const { name, code } = validation.fields;
    const result = await withPlanLimit(user.tenant_code, "branches", (client) => client.query<BranchRecord>(
      `INSERT INTO branches (tenant_code, name, code)
       VALUES ($1, $2, $3)
       RETURNING ${branchColumns}`,
      [user.tenant_code, name, code],
    ));
    return NextResponse.json({ branch: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanLimitError) return planLimitResponse(error);
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Branch code is already used in this tenant." }, { status: 409 });
    }
    console.error("Branch creation failed:", error);
    return NextResponse.json({ error: "Unable to create branch." }, { status: 500 });
  }
}
