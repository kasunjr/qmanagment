import { NextRequest, NextResponse } from "next/server";
import { createTicket, validateTicketFields } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { tenantCode: string } };

// Public: a customer books a ticket for a branch and service of this tenant.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    if (!/^[A-F0-9]{7}$/i.test(params.tenantCode)) {
      return NextResponse.json({ error: "Booking link not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateTicketFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const ticket = await createTicket(params.tenantCode.toUpperCase(), validation.fields);
    if (!ticket) return NextResponse.json({ error: "Branch or service not found." }, { status: 404 });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Ticket creation failed:", error);
    return NextResponse.json({ error: "Unable to create ticket." }, { status: 500 });
  }
}
