import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

    const tenant = await db.query("SELECT 1 FROM users WHERE tenant_code = $1", [tenantCode]);
    if (!tenant.rowCount) {
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
    return NextResponse.json({ branches: branches.rows, services: services.rows });
  } catch (error) {
    console.error("Booking options retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load booking options." }, { status: 500 });
  }
}
