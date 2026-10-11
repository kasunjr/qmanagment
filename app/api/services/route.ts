import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { serviceColumns, validateServiceFields, type ServiceRecord } from "@/lib/services";
import { isUniqueViolation } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const result = await db.query<ServiceRecord>(
      `SELECT ${serviceColumns} FROM services
       WHERE tenant_code = $1 ORDER BY created_at DESC, id`,
      [user.tenant_code],
    );
    return NextResponse.json({ services: result.rows });
  } catch (error) {
    console.error("Services retrieval failed:", error);
    return NextResponse.json({ error: "Unable to retrieve services." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateServiceFields(body);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    // No queue_services rows are needed: a new service starts in every branch's default queue.
    const { name, duration_minutes } = validation.fields;
    const result = await db.query<ServiceRecord>(
      `INSERT INTO services (tenant_code, name, duration_minutes)
       VALUES ($1, $2, $3)
       RETURNING ${serviceColumns}`,
      [user.tenant_code, name, duration_minutes],
    );
    return NextResponse.json({ service: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Service name is already used in this tenant." }, { status: 409 });
    }
    console.error("Service creation failed:", error);
    return NextResponse.json({ error: "Unable to create service." }, { status: 500 });
  }
}
