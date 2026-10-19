import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/staff-users";
import { createTicket } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Staff issues a walk-in ticket for a service in their assigned queue.
export async function POST(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.queue_id) {
      return NextResponse.json({ error: "No queue is assigned to your staff account." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const { customer_name: rawName, service_id: serviceId } = body as Record<string, unknown>;
    const customerName = typeof rawName === "string" ? rawName.trim() : "";
    if (!customerName || customerName.length > 120) {
      return NextResponse.json({ error: "Name must be between 1 and 120 characters." }, { status: 400 });
    }
    if (typeof serviceId !== "string" || !isUuid(serviceId)) {
      return NextResponse.json({ error: "Provide a valid service ID." }, { status: 400 });
    }

    const queueResult = await db.query<{ branch_id: string }>(
      `SELECT q.branch_id
       FROM staff_user_queues suq
       JOIN queues q ON q.id = suq.queue_id AND q.tenant_code = suq.tenant_code
       WHERE suq.staff_user_id = $1 AND suq.tenant_code = $2 AND suq.queue_id = $3`,
      [staffUser.id, staffUser.tenant_code, staffUser.queue_id],
    );
    const branchId = queueResult.rows[0]?.branch_id;
    if (!branchId) {
      return NextResponse.json({ error: "No queue is assigned to your staff account." }, { status: 409 });
    }

    const ticket = await createTicket(
      staffUser.tenant_code,
      { customer_name: customerName, branch_id: branchId, service_id: serviceId },
      staffUser.queue_id,
    );
    if (!ticket) {
      return NextResponse.json({ error: "This service is not available in your queue." }, { status: 404 });
    }
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Walk-in ticket creation failed:", error);
    return NextResponse.json({ error: "Unable to issue ticket." }, { status: 500 });
  }
}
