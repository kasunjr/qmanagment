import type { PoolClient } from "pg";
import { normalizeEmail } from "@/lib/auth";

// A staff user is a counter: it belongs to one branch and serves the services in service_ids.
export interface StaffUserRecord {
  id: string;
  tenant_code: string;
  name: string;
  username: string;
  email: string;
  role: string | null;
  is_enabled: boolean;
  walk_in_enabled: boolean;
  branch_id: string | null;
  counter_name: string | null;
  service_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface StaffUserFields {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  is_enabled?: boolean;
  walk_in_enabled?: boolean;
  code?: string;
  branch_id?: string | null;
  counter_name?: string | null;
  service_ids?: string[];
}

export const staffUserColumns =
  "id, tenant_code, name, username, email, role, is_enabled, walk_in_enabled, branch_id, counter_name, created_at, updated_at";
export const staffUserColumnsWithServices = `${staffUserColumns}, COALESCE((
  SELECT array_agg(sus.service_id ORDER BY sus.service_id)
  FROM staff_user_services sus WHERE sus.staff_user_id = staff_users.id
), '{}') AS service_ids`;

export function validateStaffUserFields(
  value: unknown,
  partial = false,
): { fields: StaffUserFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const fields: StaffUserFields = {};
  const has = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

  if (!partial || has("name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return { error: "Name must be between 1 and 120 characters." };
    }
    fields.name = body.name.trim();
  }

  if (!partial || has("username")) {
    if (typeof body.username !== "string" || !/^[a-zA-Z0-9._-]{3,64}$/.test(body.username.trim())) {
      return { error: "Username must be 3-64 characters using letters, numbers, dots, underscores, or hyphens." };
    }
    fields.username = body.username.trim().toLowerCase();
  }

  if (!partial || has("email")) {
    const email = normalizeEmail(body.email);
    if (!email) return { error: "Provide a valid email address." };
    fields.email = email;
  }

  if (has("role")) {
    if (typeof body.role !== "string" || !body.role.trim() || body.role.trim().length > 80) {
      return { error: "Role must be between 1 and 80 characters." };
    }
    fields.role = body.role.trim();
  }

  if (has("is_enabled")) {
    if (typeof body.is_enabled !== "boolean") {
      return { error: "Enabled status must be true or false." };
    }
    fields.is_enabled = body.is_enabled;
  }

  if (has("walk_in_enabled")) {
    if (typeof body.walk_in_enabled !== "boolean") {
      return { error: "Walk-in ticket access must be true or false." };
    }
    fields.walk_in_enabled = body.walk_in_enabled;
  }

  if (has("branch_id")) {
    if (body.branch_id !== null && (typeof body.branch_id !== "string" || !isUuid(body.branch_id))) {
      return { error: "Branch ID must be a valid branch ID or null." };
    }
    fields.branch_id = body.branch_id as string | null;
  }

  // Counter name is required on create and cannot be cleared on update.
  if (!partial || has("counter_name")) {
    const counterName = typeof body.counter_name === "string" ? body.counter_name.trim() : "";
    if (!counterName) {
      return { error: "Counter name is required." };
    }
    if (counterName.length > 60) {
      return { error: "Counter name must be at most 60 characters." };
    }
    fields.counter_name = counterName;
  }

  if (has("service_ids")) {
    if (
      !Array.isArray(body.service_ids) ||
      !body.service_ids.every((id) => typeof id === "string" && isUuid(id))
    ) {
      return { error: "Service IDs must be a list of valid service IDs." };
    }
    fields.service_ids = Array.from(new Set(body.service_ids as string[]));
  }

  if (!partial || has("code")) {
    if (typeof body.code !== "string" || Buffer.byteLength(body.code, "utf8") < 4 || Buffer.byteLength(body.code, "utf8") > 72) {
      return { error: "Code must be between 4 and 72 UTF-8 bytes." };
    }
    fields.code = body.code;
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Provide at least one staff field to update." };
  }

  return { fields };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23505";
}

export function isForeignKeyViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23503";
}

// Returns an error message when the branch or a service is not in the tenant.
export async function checkStaffAssignment(
  client: PoolClient,
  tenantCode: string,
  branchId: string | null | undefined,
  serviceIds: string[] | undefined,
): Promise<string | null> {
  if (branchId) {
    const branchResult = await client.query(
      "SELECT 1 FROM branches WHERE id = $1 AND tenant_code = $2",
      [branchId, tenantCode],
    );
    if (!branchResult.rowCount) return "Branch was not found in this tenant.";
  }
  if (serviceIds?.length) {
    const serviceResult = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM services WHERE tenant_code = $1 AND id = ANY($2::uuid[])",
      [tenantCode, serviceIds],
    );
    if (serviceResult.rows[0].count !== serviceIds.length) return "A service was not found in this tenant.";
  }
  return null;
}

export async function replaceStaffUserServices(
  client: PoolClient,
  staffUserId: string,
  serviceIds: string[],
): Promise<void> {
  await client.query("DELETE FROM staff_user_services WHERE staff_user_id = $1", [staffUserId]);
  if (serviceIds.length) {
    await client.query(
      `INSERT INTO staff_user_services (staff_user_id, service_id)
       SELECT $1, unnest($2::uuid[])`,
      [staffUserId, serviceIds],
    );
  }
}
