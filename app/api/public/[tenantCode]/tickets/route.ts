import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeDailyTicket } from "@/lib/plans";
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

    // The ticket and its count against the plan's daily limit are saved together. Rolling back
    // also returns the branch ticket number and cancels the staff notification for the ticket.
    const tenantCode = params.tenantCode.toUpperCase();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const ticket = await createTicket(tenantCode, validation.fields, client);
      if (!ticket) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Branch or service not found." }, { status: 404 });
      }
      if (!(await consumeDailyTicket(client, tenantCode))) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { error: "No more tickets are available today. Please try again tomorrow.", code: "daily_ticket_limit" },
          { status: 429 },
        );
      }
      await client.query("COMMIT");
      return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Ticket creation failed:", error);
    return NextResponse.json({ error: "Unable to create ticket." }, { status: 500 });
  }
}
