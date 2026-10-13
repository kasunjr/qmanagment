import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TicketStatusResult {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "serving" | "completed";
  created_at: Date;
}

async function getTicket(client: PoolClient, ticketId: string) {
  const result = await client.query<TicketStatusResult>(
    `SELECT t.id, t.ticket_number, t.customer_name, s.name AS service_name,
            t.status, t.created_at
     FROM tickets t
     JOIN services s ON s.id = t.service_id AND s.tenant_code = t.tenant_code
     WHERE t.id = $1`,
    [ticketId],
  );
  return result.rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
  if (!staffUser.queue_id) {
    return NextResponse.json({ error: "No queue is assigned to your staff account." }, { status: 409 });
  }

  const client = await db.connect();
  try {
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

    const currentResult = await client.query<{ id: string }>(
      `SELECT id FROM tickets
       WHERE tenant_code = $1 AND queue_id = $2 AND ticket_date = CURRENT_DATE AND status = 'serving'
       ORDER BY updated_at, ticket_number
       LIMIT 1 FOR UPDATE`,
      [staffUser.tenant_code, staffUser.queue_id],
    );
    const currentTicketId = currentResult.rows[0]?.id;
    if (!currentTicketId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "There is no serving ticket to complete." }, { status: 409 });
    }

    await client.query(
      "UPDATE tickets SET status = 'completed', updated_at = NOW() WHERE id = $1",
      [currentTicketId],
    );
    const completedTicket = await getTicket(client, currentTicketId);

    const remainingServing = await client.query(
      `SELECT 1 FROM tickets
       WHERE tenant_code = $1 AND queue_id = $2 AND ticket_date = CURRENT_DATE AND status = 'serving'
       LIMIT 1`,
      [staffUser.tenant_code, staffUser.queue_id],
    );
    let calledTicket: TicketStatusResult | null = null;
    if (!remainingServing.rowCount) {
      const nextResult = await client.query<{ id: string }>(
        `SELECT id FROM tickets
         WHERE tenant_code = $1 AND queue_id = $2 AND ticket_date = CURRENT_DATE AND status = 'waiting'
         ORDER BY created_at, ticket_number
         LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [staffUser.tenant_code, staffUser.queue_id],
      );
      if (nextResult.rows[0]) {
        const nextTicketId = nextResult.rows[0].id;
        await client.query(
          "UPDATE tickets SET status = 'serving', updated_at = NOW() WHERE id = $1",
          [nextTicketId],
        );
        calledTicket = await getTicket(client, nextTicketId);
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ completedTicket, calledTicket });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Serving ticket completion failed:", error);
    return NextResponse.json({ error: "Unable to complete the serving ticket." }, { status: 500 });
  } finally {
    client.release();
  }
}
