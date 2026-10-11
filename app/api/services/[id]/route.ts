import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  serviceColumns,
  validateServiceFields,
  type ServiceFields,
  type ServiceRecord,
} from "@/lib/services";
import { isUniqueViolation, isUuid } from "@/lib/staff-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    const validation = validateServiceFields(body, true);
    if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

    const fields: ServiceFields = validation.fields;
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [field, value] of Object.entries(fields)) {
      values.push(value);
      assignments.push(`${field} = $${values.length}`);
    }
    values.push(params.id, user.tenant_code);

    const result = await db.query<ServiceRecord>(
      `UPDATE services SET ${assignments.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND tenant_code = $${values.length}
       RETURNING ${serviceColumns}`,
      values,
    );
    const service = result.rows[0];
    if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    return NextResponse.json({ service });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Service name is already used in this tenant." }, { status: 409 });
    }
    console.error("Service update failed:", error);
    return NextResponse.json({ error: "Unable to update service." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    if (!isUuid(params.id)) return NextResponse.json({ error: "Invalid service ID." }, { status: 400 });

    // Cascades to the service's queue assignments in every branch.
    const result = await db.query<{ id: string }>(
      "DELETE FROM services WHERE id = $1 AND tenant_code = $2 RETURNING id",
      [params.id, user.tenant_code],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "Service not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Service deletion failed:", error);
    return NextResponse.json({ error: "Unable to delete service." }, { status: 500 });
  }
}
