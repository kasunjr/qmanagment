import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { serviceInQueue } from "@/lib/queues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Services that resolve to the staff member's assigned queue, for walk-in tickets.
export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.queue_id) {
      return NextResponse.json({ services: [] });
    }

    const result = await db.query<{ id: string; name: string; duration_minutes: number }>(
      `SELECT s.id, s.name, s.duration_minutes
       FROM staff_user_queues suq
       JOIN queues q ON q.id = suq.queue_id AND q.tenant_code = suq.tenant_code
       JOIN services s ON s.tenant_code = q.tenant_code
       LEFT JOIN queue_services qs ON qs.service_id = s.id AND qs.branch_id = q.branch_id
       WHERE suq.staff_user_id = $1 AND suq.tenant_code = $2 AND suq.queue_id = $3
         AND ${serviceInQueue}
       ORDER BY s.name, s.id`,
      [staffUser.id, staffUser.tenant_code, staffUser.queue_id],
    );
    return NextResponse.json({ services: result.rows });
  } catch (error) {
    console.error("Staff queue services retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load services." }, { status: 500 });
  }
}
