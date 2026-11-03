import { db } from "@/lib/db";
import { isUuid } from "@/lib/staff-users";

export interface QueueRecord {
  id: string;
  tenant_code: string;
  branch_id: string;
  name: string;
  service_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface QueueFields {
  name?: string;
  branch_id?: string;
}

// Requires the queues table to be aliased as "q".
export const queueColumns = `q.id, q.tenant_code, q.branch_id, q.name,
  COALESCE((
    SELECT array_agg(s.id ORDER BY s.name, s.id)
    FROM services s
    JOIN queue_services qs ON qs.service_id = s.id AND qs.queue_id = q.id
  ), '{}') AS service_ids,
  q.created_at, q.updated_at`;

export function validateQueueFields(
  value: unknown,
  partial = false,
): { fields: QueueFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const fields: QueueFields = {};
  const has = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

  if (!partial || has("name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return { error: "Name must be between 1 and 120 characters." };
    }
    fields.name = body.name.trim();
  }

  // A queue cannot be moved to another branch, so branch_id is only accepted on create.
  if (!partial) {
    if (typeof body.branch_id !== "string" || !isUuid(body.branch_id)) {
      return { error: "Provide a valid branch ID." };
    }
    fields.branch_id = body.branch_id;
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Provide at least one queue field to update." };
  }

  return { fields };
}

export function isForeignKeyViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "23503";
}

// The queue a service uses in a branch, or null when it has not been added to one.
export async function resolveQueueId(branchId: string, serviceId: string): Promise<string | null> {
  const result = await db.query<{ queue_id: string }>(
    "SELECT queue_id FROM queue_services WHERE branch_id = $1 AND service_id = $2",
    [branchId, serviceId],
  );
  return result.rows[0]?.queue_id ?? null;
}
