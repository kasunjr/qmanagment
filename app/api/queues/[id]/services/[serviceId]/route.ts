import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isForeignKeyViolation, queueColumns, type QueueRecord } from "@/lib/queues";
import { isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string; serviceId: string } };

// Moves a service into this queue, out of whichever queue it used in the same branch.
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid queue ID." }, { status: 400 });
    if (!isUuid(params.serviceId)) return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });

    const queueResult = await db.query<{ branch_id: string; is_default: boolean }>(
      "SELECT branch_id, is_default FROM queues WHERE id = $1 AND tenant_code = $2",
      [params.id, user.tenant_code],
    );
    const target = queueResult.rows[0];
    if (!target) return NextResponse.json({ error: "Queue not found." }, { status: 404 });

    const serviceResult = await db.query<{ id: string }>(
      "SELECT id FROM services WHERE id = $1 AND tenant_code = $2",
      [params.serviceId, user.tenant_code],
    );
    if (!serviceResult.rows[0]) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    if (target.is_default) {
      // The default queue is the absence of an assignment.
      await db.query(
        "DELETE FROM queue_services WHERE branch_id = $1 AND service_id = $2",
        [target.branch_id, params.serviceId],
      );
    } else {
      await db.query(
        `INSERT INTO queue_services (branch_id, service_id, queue_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, service_id) DO UPDATE SET queue_id = EXCLUDED.queue_id`,
        [target.branch_id, params.serviceId, params.id],
      );
    }

    const result = await db.query<QueueRecord>(
      `SELECT ${queueColumns} FROM queues q WHERE q.id = $1 AND q.tenant_code = $2`,
      [params.id, user.tenant_code],
    );
    const queue = result.rows[0];
    if (!queue) return NextResponse.json({ error: "Queue not found." }, { status: 404 });
    return NextResponse.json({ queue });
  } catch (error) {
    // The queue or service was deleted while the request was in flight.
    if (isForeignKeyViolation(error)) {
      return NextResponse.json({ error: "Queue or service not found." }, { status: 404 });
    }
    console.error("Queue service assignment failed:", error);
    return NextResponse.json({ error: "Unable to assign service to queue." }, { status: 500 });
  }
}
