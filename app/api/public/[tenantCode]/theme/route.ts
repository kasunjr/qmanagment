import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTheme } from "@/lib/theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { tenantCode: string } };

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

    return NextResponse.json({ theme: await getTheme(tenantCode) });
  } catch (error) {
    console.error("Public theme retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load theme." }, { status: 500 });
  }
}
