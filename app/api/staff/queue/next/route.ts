import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";
import { callNextTicket, getCounterTicket, lockCounter, notifyBranchTicketsChanged } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
  }
  if (!staffUser.branch_id) {
    return NextResponse.json({ error: "No branch is assigned to your counter." }, { status: 409 });
  }

  let client;
  try {
    client = await db.connect();
    await client.query("BEGIN");
    const counter = await lockCounter(client, staffUser.id, staffUser.tenant_code);
    if (!counter) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No branch is assigned to your counter." }, { status: 409 });
    }

    const servingResult = await client.query(
      `SELECT 1 FROM tickets
       WHERE served_by = $1 AND ticket_date = CURRENT_DATE AND status = 'serving'
       LIMIT 1`,
      [counter.id],
    );
    if (servingResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Complete the serving customer before calling another." }, { status: 409 });
    }

    const ticketId = await callNextTicket(client, counter);
    if (!ticketId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "No waiting customers are available for your services." }, { status: 409 });
    }

    const ticket = await getCounterTicket(client, ticketId);
    await notifyBranchTicketsChanged(client, counter.branch_id);
    await client.query("COMMIT");
    return NextResponse.json({ ticket });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Next customer call failed:", error);
    return NextResponse.json({ error: "Unable to call the next customer." }, { status: 500 });
  } finally {
    client?.release();
  }
}
