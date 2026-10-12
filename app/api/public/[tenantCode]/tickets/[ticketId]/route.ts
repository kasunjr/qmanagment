import { NextRequest, NextResponse } from "next/server";
import { isUuid } from "@/lib/staff-users";
import { getTicket } from "@/lib/tickets";

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
