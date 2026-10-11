export interface ServiceRecord {
  id: string;
  tenant_code: string;
  name: string;
  duration_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceFields {
  name?: string;
  duration_minutes?: number;
}

export const serviceColumns =
  "id, tenant_code, name, duration_minutes, created_at, updated_at";

export function validateServiceFields(
  value: unknown,
  partial = false,
): { fields: ServiceFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const fields: ServiceFields = {};
  const has = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

  if (!partial || has("name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return { error: "Name must be between 1 and 120 characters." };
    }
    fields.name = body.name.trim();
  }

  if (has("duration_minutes")) {
    const duration = body.duration_minutes;
    if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1 || duration > 1440) {
      return { error: "Duration must be a whole number of minutes between 1 and 1440." };
    }
    fields.duration_minutes = duration;
  } else if (!partial) {
    fields.duration_minutes = 15;
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Provide at least one service field to update." };
  }

  return { fields };
}
