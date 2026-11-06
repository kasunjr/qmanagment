import { NextRequest, NextResponse } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { isUuid } from "@/lib/staff-users";
import { createTicket } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Staff issues a walk-in ticket for a service their counter serves.
export async function POST(request: NextRequest) {
  try {
    const staffUser = await authenticateStaffRequest(request);
    if (!staffUser) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }
    if (!staffUser.walk_in_enabled) {
      return NextResponse.json({ error: "Walk-in ticket issuance is disabled for this counter." }, { status: 403 });
    }
    if (!staffUser.branch_id) {
      return NextResponse.json({ error: "No branch is assigned to your counter." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const { customer_name: rawName, service_id: serviceId } = body as Record<string, unknown>;
    const customerName = typeof rawName === "string" ? rawName.trim() : "";
    if (!customerName || customerName.length > 120) {
      return NextResponse.json({ error: "Name must be between 1 and 120 characters." }, { status: 400 });
    }
    if (typeof serviceId !== "string" || !isUuid(serviceId)) {
      return NextResponse.json({ error: "Provide a valid service ID." }, { status: 400 });
    }

    // The ticket joins the branch's shared waiting list, so any counter serving the service can call it.
    if (!staffUser.service_ids.includes(serviceId)) {
      return NextResponse.json({ error: "This service is not served at your counter." }, { status: 404 });
    }

    const ticket = await createTicket(
      staffUser.tenant_code,
      { customer_name: customerName, branch_id: staffUser.branch_id, service_id: serviceId },
    );
    if (!ticket) {
      return NextResponse.json({ error: "This service is not served at your counter." }, { status: 404 });
    }
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Walk-in ticket creation failed:", error);
    return NextResponse.json({ error: "Unable to issue ticket." }, { status: 500 });
  }
}
