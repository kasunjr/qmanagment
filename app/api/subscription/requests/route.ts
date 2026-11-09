import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/staff-users";
import {
  createUpgradeRequest,
  getLatestUpgradeRequest,
  upgradeRequestProblem,
  validateUpgradeRequestFields,
} from "@/lib/upgrade-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The tenant's most recent upgrade request, whatever its status; null if it has never sent one.
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const upgradeRequest = await getLatestUpgradeRequest(user.tenant_code);
    return NextResponse.json({ request: upgradeRequest }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Upgrade request retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve your upgrade request." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateUpgradeRequestFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });
    const { planCode, note } = validation.fields;

    const problem = await upgradeRequestProblem(user.tenant_code, planCode);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const upgradeRequest = await createUpgradeRequest(user.tenant_code, planCode, note);
    return NextResponse.json({ request: upgradeRequest }, { status: 201 });
  } catch (error) {
    // The database allows one pending request per tenant, which also covers two clicks at once.
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "You already have a pending upgrade request.", code: "request_pending" },
        { status: 409 },
      );
    }
    console.error("Upgrade request creation failed:", error);
    return NextResponse.json({ error: "Unable to send your upgrade request." }, { status: 500 });
  }
}
