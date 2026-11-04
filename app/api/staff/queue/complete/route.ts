import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { getCounterTicket, lockCounter, notifyBranchTicketsChanged } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Completes this counter's serving ticket. It does not call the next ticket: the counter stays
// free until staff call the next customer with POST /api/staff/queue/next.
export async function POST(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
  if (!staffUser.branch_id) {
    return NextResponse.json({ error: "No branch is assigned to your counter." }, { status: 409 });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const counter = await lockCounter(client, staffUser.id, staffUser.tenant_code);
    if (!counter) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No branch is assigned to your counter." }, { status: 409 });
    }

    const currentResult = await client.query<{ id: string }>(
      `SELECT id FROM tickets
       WHERE served_by = $1 AND ticket_date = CURRENT_DATE AND status = 'serving'
       LIMIT 1 FOR UPDATE`,
      [counter.id],
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
    const completedTicket = await getCounterTicket(client, currentTicketId);

    await notifyBranchTicketsChanged(client, counter.branch_id);
    await client.query("COMMIT");
    return NextResponse.json({ completedTicket });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Serving ticket completion failed:", error);
    return NextResponse.json({ error: "Unable to complete the serving ticket." }, { status: 500 });
  } finally {
    client.release();
  }
}
