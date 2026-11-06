import { NextRequest } from "next/server";
import { authenticateStaffRequest } from "@/lib/staff-auth";
import { createQueueEventResponse } from "@/lib/queue-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staffUser = await authenticateStaffRequest(request);
  if (!staffUser) {
    return new Response("Staff authentication required.", { status: 401 });
  }
  if (!staffUser.branch_id) {
    return new Response(null, { status: 204 });
  }
  return createQueueEventResponse(
    request,
    staffUser.branch_id,
    staffUser.tenant_code,
  );
}
