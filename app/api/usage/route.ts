import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getTenantUsage } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The account's current plan, its limits, and how much of each limit is used.
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const usage = await getTenantUsage(user.tenant_code);
    if (!usage) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    return NextResponse.json(usage);
  } catch (error) {
    console.error("Usage retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve usage." }, { status: 500 });
  }
}
