import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { isAcceptingTickets } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AssignedQueueTicketRow {
  queue_id: string;
  queue_name: string;
  branch_name: string;
  ticket_id: string | null;
  ticket_number: number | null;
  customer_name: string | null;
  service_name: string | null;
  status: "waiting" | "serving" | "completed" | null;
  created_at: Date | null;
}

export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.queue_id) {
      return NextResponse.json({ queue: null, tickets: [], daily_limit_reached: false });
    }

    // Staff only learn whether customers can still book today, not the plan or its numbers.
    const dailyLimitReached = (await isAcceptingTickets(staffUser.tenant_code)) === false;
    const result = await db.query<AssignedQueueTicketRow>(
      `SELECT q.id AS queue_id, q.name AS queue_name, b.name AS branch_name,
              t.id AS ticket_id, t.ticket_number, t.customer_name,
              s.name AS service_name, t.status, t.created_at
       FROM staff_user_queues suq
       JOIN queues q ON q.id = suq.queue_id AND q.tenant_code = suq.tenant_code
       JOIN branches b ON b.id = q.branch_id AND b.tenant_code = q.tenant_code
       LEFT JOIN tickets t ON t.queue_id = q.id AND t.tenant_code = suq.tenant_code
         AND t.ticket_date = CURRENT_DATE
       LEFT JOIN services s ON s.id = t.service_id AND s.tenant_code = t.tenant_code
       WHERE suq.staff_user_id = $1 AND suq.tenant_code = $2 AND suq.queue_id = $3
       ORDER BY CASE t.status
         WHEN 'serving' THEN 0
         WHEN 'waiting' THEN 1
         ELSE 2
       END, t.ticket_number`,
      [staffUser.id, staffUser.tenant_code, staffUser.queue_id],
    );
    const queueRow = result.rows[0];
    if (!queueRow) return NextResponse.json({ queue: null, tickets: [], daily_limit_reached: false });

    const tickets = result.rows.flatMap((row) => row.ticket_id ? [{
      id: row.ticket_id,
      ticket_number: row.ticket_number,
      customer_name: row.customer_name,
      service_name: row.service_name,
      status: row.status,
      created_at: row.created_at,
    }] : []);
    return NextResponse.json({
      queue: {
        id: queueRow.queue_id,
        name: queueRow.queue_name,
        branch_name: queueRow.branch_name,
      },
      tickets,
      daily_limit_reached: dailyLimitReached,
    });
  } catch (error) {
    console.error("Staff queue retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve assigned queue." }, { status: 500 });
  }
}
