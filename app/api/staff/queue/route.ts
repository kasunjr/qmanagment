import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { isAcceptingTickets } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CounterTicketRow {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "waiting" | "serving" | "completed";
  created_at: Date;
}

// The staff member's counter: its own serving and completed tickets for today, and the
// branch's waiting tickets for the services it serves, shared with other counters.
export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.branch_id) {
      return NextResponse.json({ counter: null, tickets: [], daily_limit_reached: false });
    }

    // Staff only learn whether customers can still book today, not the plan or its numbers.
    const [dailyLimit, branchResult, servicesResult, ticketsResult] = await Promise.all([
      isAcceptingTickets(staffUser.tenant_code),
      db.query<{ name: string }>(
        "SELECT name FROM branches WHERE id = $1 AND tenant_code = $2",
        [staffUser.branch_id, staffUser.tenant_code],
      ),
      db.query<{ id: string; name: string }>(
        `SELECT s.id, s.name
         FROM staff_user_services sus
         JOIN services s ON s.id = sus.service_id AND s.tenant_code = $2
         WHERE sus.staff_user_id = $1
         ORDER BY s.name, s.id`,
        [staffUser.id, staffUser.tenant_code],
      ),
      db.query<CounterTicketRow>(
        `SELECT t.id, t.ticket_number, t.customer_name, s.name AS service_name, t.status, t.created_at
         FROM tickets t
         JOIN services s ON s.id = t.service_id AND s.tenant_code = t.tenant_code
         WHERE t.tenant_code = $2 AND t.branch_id = $3 AND t.ticket_date = CURRENT_DATE
           AND (
             (t.status = 'waiting' AND t.service_id IN (
               SELECT service_id FROM staff_user_services WHERE staff_user_id = $1
             ))
             OR (t.status IN ('serving', 'completed') AND t.served_by = $1)
           )
         ORDER BY CASE t.status
           WHEN 'serving' THEN 0
           WHEN 'waiting' THEN 1
           ELSE 2
         END, t.created_at, t.ticket_number`,
        [staffUser.id, staffUser.tenant_code, staffUser.branch_id],
      ),
    ]);
    const branch = branchResult.rows[0];
    if (!branch) return NextResponse.json({ counter: null, tickets: [], daily_limit_reached: false });

    return NextResponse.json({
      counter: {
        name: staffUser.counter_name,
        branch_name: branch.name,
        services: servicesResult.rows,
      },
      tickets: ticketsResult.rows,
      daily_limit_reached: dailyLimit === false,
    });
  } catch (error) {
    console.error("Staff counter retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve your counter." }, { status: 500 });
  }
}
