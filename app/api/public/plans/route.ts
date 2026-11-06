import { NextResponse } from "next/server";
import { DEFAULT_PLAN_CODE, listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = (await listPlans()).find((entry) => entry.code === DEFAULT_PLAN_CODE);
    if (!plan) return NextResponse.json({ error: "Plan information is unavailable." }, { status: 503 });
    return NextResponse.json({ plan }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Plan information is unavailable." }, { status: 503 });
  }
}