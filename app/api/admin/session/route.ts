import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    return NextResponse.json({ message: "Admin access granted.", user });
  } catch (error) {
    console.error("Admin authorization failed:", error);
    return NextResponse.json({ error: "Unable to verify admin access." }, { status: 500 });
  }
}