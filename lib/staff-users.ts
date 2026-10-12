import { normalizeEmail } from "@/lib/auth";

export interface StaffUserRecord {
  id: string;
  tenant_code: string;
  name: string;
  username: string;
  email: string;
  role: string;
  queue_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface StaffUserFields {
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  code?: string;
  queue_ids?: string[];
}

export const staffUserColumns =
  "id, tenant_code, name, username, email, role, created_at, updated_at";
export const staffUserColumnsWithQueues = `${staffUserColumns}, COALESCE((
  SELECT array_agg(suq.queue_id ORDER BY suq.queue_id)
  FROM staff_user_queues suq WHERE suq.staff_user_id = staff_users.id
), '{}') AS queue_ids`;

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
  } else if (!partial) {
    fields.role = "Agent";
  }

  if (has("queue_ids")) {
    if (
      !Array.isArray(body.queue_ids) ||
      body.queue_ids.some((id) => typeof id !== "string" || !isUuid(id)) ||
      new Set(body.queue_ids).size !== body.queue_ids.length
    ) {
      return { error: "Queue IDs must be an array of unique valid queue IDs." };
    }
    fields.queue_ids = body.queue_ids as string[];
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
