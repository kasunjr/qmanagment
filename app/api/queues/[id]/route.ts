import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isForeignKeyViolation,
  queueColumns,
  validateQueueFields,
  type QueueRecord,
} from "@/lib/queues";
import { isUniqueViolation, isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid queue ID." }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateQueueFields(body, true);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const result = await db.query<QueueRecord>(
      `UPDATE queues q SET name = $1, updated_at = NOW()
       WHERE q.id = $2 AND q.tenant_code = $3
       RETURNING ${queueColumns}`,
      [validation.fields.name, params.id, user.tenant_code],
    );
    const queue = result.rows[0];
    if (!queue) return NextResponse.json({ error: "Queue not found." }, { status: 404 });
    return NextResponse.json({ queue });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Queue name is already used in this branch." }, { status: 409 });
    }
    console.error("Queue update failed:", error);
    return NextResponse.json({ error: "Unable to update queue." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid queue ID." }, { status: 400 });

    const existing = await db.query<{ is_default: boolean }>(
      "SELECT is_default FROM queues WHERE id = $1 AND tenant_code = $2",
      [params.id, user.tenant_code],
    );
    const queue = existing.rows[0];
    if (!queue) return NextResponse.json({ error: "Queue not found." }, { status: 404 });
    if (queue.is_default) {
      return NextResponse.json({ error: "The default queue cannot be deleted." }, { status: 409 });
    }

    // Fails with a foreign key violation while services are still assigned to the queue.
    const result = await db.query<{ id: string }>(
      "DELETE FROM queues WHERE id = $1 AND tenant_code = $2 AND NOT is_default RETURNING id",
      [params.id, user.tenant_code],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Queue not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return NextResponse.json(
        { error: "Move this queue's services to another queue before deleting it." },
        { status: 409 },
      );
    }
    console.error("Queue deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete queue." }, { status: 500 });
  }
}
