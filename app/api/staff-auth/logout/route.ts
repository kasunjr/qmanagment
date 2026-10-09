import { NextRequest, NextResponse } from "next/server";
import { clearStaffAuthCookies } from "@/lib/staff-auth";
import { STAFF_TENANT_COOKIE } from "@/lib/staff-auth-constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tenantCode = request.cookies.get(STAFF_TENANT_COOKIE)?.value;
  const response = NextResponse.json({ tenantCode });
  clearStaffAuthCookies(response);
  return response;
}
