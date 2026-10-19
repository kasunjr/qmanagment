import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAcceptingTickets } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { tenantCode: string } };

// Public: lists what a customer can book for a tenant. Only display fields are exposed.
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!/^[A-F0-9]{7}$/i.test(params.tenantCode)) {
      return NextResponse.json({ error: "Booking link not found." }, { status: 404 });
    }
    const tenantCode = params.tenantCode.toUpperCase();

    // Only whether booking is open is exposed, not the plan or its limits.
    const acceptingTickets = await isAcceptingTickets(tenantCode);
    if (acceptingTickets === null) {
      return NextResponse.json({ error: "Booking link not found." }, { status: 404 });
    }

    const [branches, services] = await Promise.all([
      db.query<{ id: string; name: string; code: string }>(
        "SELECT id, name, code FROM branches WHERE tenant_code = $1 ORDER BY name, id",
        [tenantCode],
      ),
      db.query<{ id: string; name: string; duration_minutes: number }>(
        "SELECT id, name, duration_minutes FROM services WHERE tenant_code = $1 ORDER BY name, id",
        [tenantCode],
      ),
    ]);
    return NextResponse.json({
      branches: branches.rows,
      services: services.rows,
      accepting_tickets: acceptingTickets,
    });
  } catch (error) {
    console.error("Booking options retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load booking options." }, { status: 500 });
  }
}
