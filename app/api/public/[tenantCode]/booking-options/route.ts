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

    // A service is bookable at a branch when at least one counter there serves it.
    // Branches with no bookable service are left out; service_ids lists the bookable ones.
    const [branches, services] = await Promise.all([
      db.query<{ id: string; name: string; code: string; service_ids: string[] }>(
        `SELECT b.id, b.name, b.code, array_agg(DISTINCT sus.service_id) AS service_ids
         FROM branches b
         JOIN staff_users su ON su.branch_id = b.id AND su.tenant_code = b.tenant_code
         JOIN staff_user_services sus ON sus.staff_user_id = su.id
         WHERE b.tenant_code = $1
         GROUP BY b.id
         ORDER BY b.name, b.id`,
        [tenantCode],
      ),
      db.query<{ id: string; name: string; description: string; duration_minutes: number }>(
        "SELECT id, name, description, duration_minutes FROM services WHERE tenant_code = $1 ORDER BY name, id",
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
