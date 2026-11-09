import { db } from "@/lib/db";
import { DEFAULT_PLAN_CODE, getTenantUsage, listPlans } from "@/lib/plans";

export const UPGRADE_NOTE_MAX_LENGTH = 500;

export type UpgradeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

// What a tenant sees of its own request. admin_note is internal and left out.
export interface UpgradeRequestRecord {
  id: string;
  plan_code: string;
  plan_name: string;
  note: string | null;
  status: UpgradeRequestStatus;
  created_at: string;
  decided_at: string | null;
}

const requestColumns = `r.id::text AS id, r.plan_code, p.name AS plan_name, r.note, r.status,
  r.created_at, r.decided_at`;

export function validateUpgradeRequestFields(
  body: unknown,
): { fields: { planCode: string; note: string | null } } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Request body must be an object." };
  const { plan_code: planCode, note } = body as Record<string, unknown>;

  if (typeof planCode !== "string" || !planCode.trim()) return { error: "Choose a plan to request." };
  if (note !== undefined && note !== null && typeof note !== "string") return { error: "Note must be text." };

  const trimmedNote = typeof note === "string" ? note.trim() : "";
  if (trimmedNote.length > UPGRADE_NOTE_MAX_LENGTH) {
    return { error: `Note must be ${UPGRADE_NOTE_MAX_LENGTH} characters or fewer.` };
  }
  return { fields: { planCode: planCode.trim(), note: trimmedNote || null } };
}

export async function upgradeRequestProblem(tenantCode: string, planCode: string): Promise<string | null> {
  if (planCode === DEFAULT_PLAN_CODE) return "Basic is the free plan, so there is nothing to request.";

  const [plans, usage] = await Promise.all([listPlans(), getTenantUsage(tenantCode)]);
  if (!usage) return "Subscription not found.";

  const requestedIndex = plans.findIndex((plan) => plan.code === planCode);
  if (requestedIndex === -1) return "That plan does not exist.";

  const currentIndex = plans.findIndex((plan) => plan.code === usage.plan_code);
  if (currentIndex > requestedIndex) {
    return `Your ${usage.plan_name} plan already includes more than ${plans[requestedIndex].name}.`;
  }
  return null;
}

export async function createUpgradeRequest(
  tenantCode: string,
  planCode: string,
  note: string | null,
): Promise<UpgradeRequestRecord> {
  const result = await db.query<UpgradeRequestRecord>(
    `WITH r AS (
       INSERT INTO plan_upgrade_requests (tenant_code, plan_code, note)
       VALUES ($1, $2, $3)
       RETURNING *
     )
     SELECT ${requestColumns} FROM r JOIN plans p ON p.code = r.plan_code`,
    [tenantCode, planCode, note],
  );
  return result.rows[0];
}

export async function getLatestUpgradeRequest(tenantCode: string): Promise<UpgradeRequestRecord | null> {
  const result = await db.query<UpgradeRequestRecord>(
    `SELECT ${requestColumns}
     FROM plan_upgrade_requests r JOIN plans p ON p.code = r.plan_code
     WHERE r.tenant_code = $1
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1`,
    [tenantCode],
  );
  return result.rows[0] ?? null;
}
