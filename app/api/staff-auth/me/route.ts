import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    return NextResponse.json({ staffUser });
  } catch (error) {
    console.error("Staff authentication check failed:", error);
    return NextResponse.json({ error: "Unable to verify staff session." }, { status: 500 });
  }
}
