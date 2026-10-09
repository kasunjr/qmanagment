import { NextRequest, NextResponse } from "next/server";
import { refreshCookieName, rotateRefreshToken, setAccessCookie, setRefreshCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(refreshCookieName())?.value;
  if (!token) return NextResponse.json({ error: "Refresh token is required." }, { status: 401 });

  try {
    const session = await rotateRefreshToken(token);
    if (!session) return NextResponse.json({ error: "Refresh token is invalid or expired." }, { status: 401 });
    const response = NextResponse.json({ user: session.user, accessToken: session.accessToken });
    setRefreshCookie(response, session.refreshToken);
    setAccessCookie(response, session.accessToken);
    return response;
  } catch (error) {
    console.error("Token refresh failed:", error);
    return NextResponse.json({ error: "Unable to refresh session." }, { status: 500 });
  }
}