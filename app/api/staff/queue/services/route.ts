import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Services the staff member's counter serves, for walk-in tickets.
export async function GET(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.walk_in_enabled) {
      return NextResponse.json({ error: "Walk-in ticket issuance is disabled for this counter." }, { status: 403 });
    }
    if (!staffUser.branch_id) {
      return NextResponse.json({ services: [] });
    }

    const result = await db.query<{ id: string; name: string; description: string; duration_minutes: number }>(
      `SELECT s.id, s.name, s.description, s.duration_minutes
       FROM staff_user_services sus
       JOIN services s ON s.id = sus.service_id AND s.tenant_code = $2
       WHERE sus.staff_user_id = $1
       ORDER BY s.name, s.id`,
      [staffUser.id, staffUser.tenant_code],
    );
    return NextResponse.json({ services: result.rows });
  } catch (error) {
    console.error("Staff queue services retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load services." }, { status: 500 });
  }
}
