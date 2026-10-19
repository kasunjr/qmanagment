import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getTheme, saveTheme, validateThemeFields } from "@/lib/theme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    return NextResponse.json({ theme: await getTheme(user.tenant_code) });
  } catch (error) {
    console.error("Theme retrieval failed:", error);
    return NextResponse.json({ error: "Unable to load theme." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateThemeFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    return NextResponse.json({ theme: await saveTheme(user.tenant_code, validation.fields) });
  } catch (error) {
    console.error("Theme update failed:", error);
    return NextResponse.json({ error: "Unable to save theme." }, { status: 500 });
  }
}
