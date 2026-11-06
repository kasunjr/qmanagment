import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/staff-users";
import { BRANCH_TICKETS_CHANNEL, getTicket } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { tenantCode: string; ticketId: string } };

// Public: the current state of a ticket, for the customer who holds its ID.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!/^[A-F0-9]{7}$/i.test(params.tenantCode) || !isUuid(params.ticketId)) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    const ticket = await getTicket(params.tenantCode.toUpperCase(), params.ticketId);
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Ticket retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve ticket." }, { status: 500 });
  }
}

// Public: a ticket ID acts as the customer's capability to remove their own waiting ticket.
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!/^[A-F0-9]{7}$/i.test(params.tenantCode) || !isUuid(params.ticketId)) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    const result = await db.query<{ branch_id: string }>(
      `WITH removed AS (
         DELETE FROM tickets
         WHERE id = $1 AND tenant_code = $2 AND ticket_date = CURRENT_DATE AND status = 'waiting'
         RETURNING branch_id
       )
       SELECT removed.branch_id, pg_notify($3, removed.branch_id::text) AS notified
       FROM removed`,
      [params.ticketId, params.tenantCode.toUpperCase(), BRANCH_TICKETS_CHANNEL],
    );
    if (!result.rows[0]) {
      return NextResponse.json(
        { error: "This ticket is no longer waiting and cannot be removed." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ticket removal failed:", error);
    return NextResponse.json({ error: "Unable to remove ticket from the queue." }, { status: 500 });
  }
}
