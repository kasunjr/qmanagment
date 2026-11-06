import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createQueueEventResponse } from "@/lib/queue-events";
import { isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { tenantCode: string; ticketId: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!/^[A-F0-9]{7}$/i.test(params.tenantCode) || !isUuid(params.ticketId)) {
    return new Response("Ticket not found.", { status: 404 });
  }

  try {
    const result = await db.query<{ branch_id: string }>(
      `SELECT branch_id FROM tickets
       WHERE id = $1 AND tenant_code = $2 AND ticket_date = CURRENT_DATE`,
      [params.ticketId, params.tenantCode.toUpperCase()],
    );
    const ticket = result.rows[0];
    if (!ticket) return new Response("Ticket not found.", { status: 404 });
    return await createQueueEventResponse(request, ticket.branch_id);
  } catch (error) {
    console.error("Customer ticket event subscription failed:", error);
    return new Response("Unable to subscribe to ticket events.", {
      status: 500,
    });
  }
}
