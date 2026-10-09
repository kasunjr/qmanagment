import { NextRequest, NextResponse } from "next/server";
import { clearAccessCookie, clearRefreshCookie, refreshCookieName, revokeRefreshToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await revokeRefreshToken(request.cookies.get(refreshCookieName())?.value);
    const response = NextResponse.json({ message: "Logged out." });
    clearRefreshCookie(response);
    clearAccessCookie(response);
    return response;
  } catch (error) {
    console.error("Logout failed:", error);
    return NextResponse.json({ error: "Unable to log out." }, { status: 500 });
  }
}