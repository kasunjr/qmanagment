import { jwtVerify } from "jose/jwt/verify";
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "qms_access";
const JWT_ISSUER = "queue-management-system";
const JWT_AUDIENCE = "queue-management-api";

export async function middleware(request: NextRequest) {
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
  matcher: ["/admin/:path*"],
};