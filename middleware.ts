import { jwtVerify } from "jose/jwt/verify";
import { NextRequest, NextResponse } from "next/server";
import {
  STAFF_ACCESS_COOKIE,
  STAFF_JWT_AUDIENCE,
  STAFF_JWT_ISSUER,
  STAFF_TENANT_COOKIE,
} from "@/lib/staff-auth-constants";

const ACCESS_COOKIE = "qms_access";
const JWT_ISSUER = "queue-management-system";
const JWT_AUDIENCE = "queue-management-api";

export async function middleware(request: NextRequest) {
  const isStaffPath = request.nextUrl.pathname === "/staff" ||
    request.nextUrl.pathname.startsWith("/staff/");

  if (isStaffPath) {
    const staffToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
    const staffSecret = process.env.JWT_STAFF_ACCESS_SECRET;

    if (staffToken && staffSecret && staffSecret.length >= 32) {
      try {
        const { payload } = await jwtVerify(staffToken, new TextEncoder().encode(staffSecret), {
          issuer: STAFF_JWT_ISSUER,
          audience: STAFF_JWT_AUDIENCE,
          algorithms: ["HS256"],
        });
        if (payload.sub && typeof payload.tenant_code === "string" && /^[A-F0-9]{7}$/.test(payload.tenant_code)) {
          return NextResponse.next();
        }
      } catch {
        // Invalid, expired, or incorrectly signed staff token.
      }
    }

    const tenantCode = request.cookies.get(STAFF_TENANT_COOKIE)?.value;
    if (tenantCode && /^[A-F0-9]{7}$/.test(tenantCode)) {
      return NextResponse.redirect(new URL(`/${tenantCode}/staff`, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (token && secret && secret.length >= 32) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"],
      });
      if (payload.sub) return NextResponse.next();
    } catch {
      // Invalid, expired, or incorrectly signed access token.
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*"],
};