import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { queueColumns, validateQueueFields, type QueueRecord } from "@/lib/queues";
import { isUniqueViolation, isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const branchId = request.nextUrl.searchParams.get("branch_id");
    if (branchId !== null && !isUuid(branchId)) {
      return NextResponse.json({ error: "Invalid branch ID." }, { status: 400 });
    }

    const values: unknown[] = [user.tenant_code];
    if (branchId !== null) values.push(branchId);

    const result = await db.query<QueueRecord>(
      `SELECT ${queueColumns} FROM queues q
       WHERE q.tenant_code = $1${branchId !== null ? " AND q.branch_id = $2" : ""}
       ORDER BY q.branch_id, q.is_default DESC, q.created_at, q.id`,
      values,
    );
    return NextResponse.json({ queues: result.rows });
  } catch (error) {
    console.error("Queues retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve queues." }, { status: 500 });
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

    const validation = validateQueueFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    // Selecting from branches ensures the branch belongs to this tenant.
    const { name, branch_id } = validation.fields;
    const result = await db.query<QueueRecord>(
      `INSERT INTO queues AS q (tenant_code, branch_id, name)
       SELECT b.tenant_code, b.id, $3 FROM branches b
       WHERE b.id = $2 AND b.tenant_code = $1
       RETURNING ${queueColumns}`,
      [user.tenant_code, branch_id, name],
    );
    const queue = result.rows[0];
    if (!queue) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
    return NextResponse.json({ queue }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Queue name is already used in this branch." }, { status: 409 });
    }
    console.error("Queue creation failed:", error);
    return NextResponse.json({ error: "Unable to create queue." }, { status: 500 });
  }
}
