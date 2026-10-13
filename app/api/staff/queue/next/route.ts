import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CalledTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "serving";
  created_at: Date;
}

export async function POST(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
  if (!staffUser.queue_id) {
    return NextResponse.json({ error: "No queue is assigned to your staff account." }, { status: 409 });
  }

  let client;
  try {
    client = await db.connect();
      await client.query("BEGIN");
      const assignedQueue = await client.query<{ id: string }>(
        `SELECT q.id
         FROM staff_user_queues suq
         JOIN queues q ON q.id = suq.queue_id AND q.tenant_code = suq.tenant_code
         WHERE suq.staff_user_id = $1 AND suq.tenant_code = $2 AND suq.queue_id = $3
         FOR UPDATE OF q`,
        [staffUser.id, staffUser.tenant_code, staffUser.queue_id],
      );
      if (!assignedQueue.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No queue is assigned to your staff account." }, { status: 409 });
      }

      const servingResult = await client.query(
        `SELECT 1 FROM tickets
         WHERE tenant_code = $1 AND queue_id = $2 AND ticket_date = CURRENT_DATE AND status = 'serving'
         LIMIT 1`,
        [staffUser.tenant_code, staffUser.queue_id],
      );
      if (servingResult.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Complete the serving customer before calling another." }, { status: 409 });
      }

      const nextResult = await client.query<{ id: string }>(
        `SELECT id FROM tickets
         WHERE tenant_code = $1 AND queue_id = $2 AND ticket_date = CURRENT_DATE AND status = 'waiting'
         ORDER BY created_at, ticket_number
         LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [staffUser.tenant_code, staffUser.queue_id],
      );
      const ticketId = nextResult.rows[0]?.id;
      if (!ticketId) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No waiting customers are available in your queue." }, { status: 409 });
      }

      await client.query(
        "UPDATE tickets SET status = 'serving', updated_at = NOW() WHERE id = $1",
        [ticketId],
      );
      const result = await client.query<CalledTicket>(
        `SELECT t.id, t.ticket_number, t.customer_name, s.name AS service_name,
                t.status, t.created_at
         FROM tickets t
         JOIN services s ON s.id = t.service_id AND s.tenant_code = t.tenant_code
         WHERE t.id = $1`,
        [ticketId],
      );
      await client.query("COMMIT");
      return NextResponse.json({ ticket: result.rows[0] });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Next customer call failed:", error);
    return NextResponse.json({ error: "Unable to call the next customer." }, { status: 500 });
  } finally {
    client?.release();
  }
}
