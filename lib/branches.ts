export interface BranchRecord {
  id: string;
  tenant_code: string;
  name: string;
  code: string;
  created_at: Date;
  updated_at: Date;
}

export interface BranchFields {
  name?: string;
  code?: string;
}

export const branchColumns = "id, tenant_code, name, code, created_at, updated_at";

export function validateBranchFields(
  value: unknown,
  partial = false,
): { fields: BranchFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;
  const fields: BranchFields = {};
  const has = (field: string) => Object.prototype.hasOwnProperty.call(body, field);

  if (!partial || has("name")) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120) {
      return { error: "Name must be between 1 and 120 characters." };
    }
    fields.name = body.name.trim();
  }

  if (!partial || has("code")) {
    if (typeof body.code !== "string" || !/^[a-zA-Z0-9_-]{1,20}$/.test(body.code.trim())) {
      return { error: "Code must be 1-20 characters using letters, numbers, underscores, or hyphens." };
    }
    fields.code = body.code.trim().toUpperCase();
  }

  if (partial && Object.keys(fields).length === 0) {
    return { error: "Provide at least one branch field to update." };
  }

  return { fields };
}
