import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { getTheme } from "@/lib/theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    return NextResponse.json({ theme: await getTheme(staffUser.tenant_code) });
  } catch (error) {
    console.error("Staff theme retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load theme." }, { status: 500 });
  }
}
