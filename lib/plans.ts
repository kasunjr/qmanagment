import { NextResponse } from "next/server";
import type { Pool, PoolClient } from "pg";
import { db } from "@/lib/db";

type Queryable = Pool | PoolClient;

export const DEFAULT_PLAN_CODE = "basic";

// A subscription gives its plan only while active and not expired; otherwise the basic plan applies.
const effectivePlanCode = `CASE
  WHEN ts.status = 'active' AND (ts.expires_at IS NULL OR ts.expires_at > NOW()) THEN ts.plan_code
  ELSE '${DEFAULT_PLAN_CODE}'
END`;

const tenantPlan = `tenant_subscriptions ts JOIN plans p ON p.code = ${effectivePlanCode}`;

export const planResources = {
  branches: { table: "branches", limitColumn: "max_branches", singular: "branch", plural: "branches" },
  services: { table: "services", limitColumn: "max_services", singular: "service", plural: "services" },
  queues: { table: "queues", limitColumn: "max_queues", singular: "queue", plural: "queues" },
  staff_users: {
    table: "staff_users",
    limitColumn: "max_staff_users",
    singular: "staff member",
    plural: "staff members",
  },
} as const;

export type PlanResource = keyof typeof planResources;

// null means unlimited.
export interface PlanLimits {
  branches: number | null;
  services: number | null;
  queues: number | null;
  staff_users: number | null;
  tickets_per_day: number | null;
}

export interface PlanUsage {
  branches: number;
  services: number;
  queues: number;
  staff_users: number;
  tickets_today: number;
}

// The plan the tenant subscribed to, which differs from the plan in effect once it has expired.
export interface TenantSubscription {
  plan_code: string;
  plan_name: string;
  expires_at: string | null;
  expired: boolean;
}

export interface TenantUsage {
  plan_code: string;
  plan_name: string;
  limits: PlanLimits;
  usage: PlanUsage;
  subscription: TenantSubscription;
}

export interface PlanRecord {
  code: string;
  name: string;
  price_label: string;
  limits: PlanLimits;
}

export async function listPlans(): Promise<PlanRecord[]> {
  const result = await db.query<{
    code: string;
    name: string;
    price_label: string;
    max_branches: number | null;
    max_services: number | null;
    max_queues: number | null;
    max_staff_users: number | null;
    max_tickets_per_day: number | null;
  }>(
    `SELECT code, name, price_label, max_branches, max_services, max_queues,
            max_staff_users, max_tickets_per_day
     FROM plans ORDER BY sort_order, code`,
  );
  return result.rows.map((row) => ({
    code: row.code,
    name: row.name,
    price_label: row.price_label,
    limits: {
      branches: row.max_branches,
      services: row.max_services,
      queues: row.max_queues,
      staff_users: row.max_staff_users,
      tickets_per_day: row.max_tickets_per_day,
    },
  }));
}

export class PlanLimitError extends Error {
  constructor(
    readonly resource: PlanResource,
    readonly limit: number,
    readonly planName: string,
  ) {
    const { singular, plural } = planResources[resource];
    super(`Your ${planName} plan allows ${limit} ${limit === 1 ? singular : plural}. Upgrade your plan to add more.`);
    this.name = "PlanLimitError";
  }
}

export function planLimitResponse(error: PlanLimitError): NextResponse {
  return NextResponse.json(
    { error: error.message, code: "plan_limit", resource: error.resource, limit: error.limit },
    { status: 403 },
  );
}

// Returns null when the tenant has no subscription, i.e. the tenant does not exist.
export async function getTenantUsage(tenantCode: string, client: Queryable = db): Promise<TenantUsage | null> {
  const result = await client.query<{
    plan_code: string;
    plan_name: string;
    max_branches: number | null;
    max_services: number | null;
    max_queues: number | null;
    max_staff_users: number | null;
    max_tickets_per_day: number | null;
    branches: number;
    services: number;
    queues: number;
    staff_users: number;
    tickets_today: number;
    subscribed_plan_code: string;
    subscribed_plan_name: string;
    expires_at: Date | null;
  }>(
    `SELECT p.code AS plan_code, p.name AS plan_name,
            p.max_branches, p.max_services, p.max_queues, p.max_staff_users, p.max_tickets_per_day,
            sp.code AS subscribed_plan_code, sp.name AS subscribed_plan_name, ts.expires_at,
            (SELECT COUNT(*)::int FROM branches WHERE tenant_code = ts.tenant_code) AS branches,
            (SELECT COUNT(*)::int FROM services WHERE tenant_code = ts.tenant_code) AS services,
            (SELECT COUNT(*)::int FROM queues WHERE tenant_code = ts.tenant_code) AS queues,
            (SELECT COUNT(*)::int FROM staff_users WHERE tenant_code = ts.tenant_code) AS staff_users,
            COALESCE((SELECT tickets_created FROM tenant_daily_usage
                      WHERE tenant_code = ts.tenant_code AND usage_date = CURRENT_DATE), 0) AS tickets_today
     FROM ${tenantPlan}
     JOIN plans sp ON sp.code = ts.plan_code
     WHERE ts.tenant_code = $1`,
    [tenantCode],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    plan_code: row.plan_code,
    plan_name: row.plan_name,
    limits: {
      branches: row.max_branches,
      services: row.max_services,
      queues: row.max_queues,
      staff_users: row.max_staff_users,
      tickets_per_day: row.max_tickets_per_day,
    },
    usage: {
      branches: row.branches,
      services: row.services,
      queues: row.queues,
      staff_users: row.staff_users,
      tickets_today: row.tickets_today,
    },
    subscription: {
      plan_code: row.subscribed_plan_code,
      plan_name: row.subscribed_plan_name,
      expires_at: row.expires_at?.toISOString() ?? null,
      expired: row.subscribed_plan_code !== row.plan_code,
    },
  };
}

// For use inside an open transaction. Locking the subscription row makes concurrent creates for
// the same tenant wait for each other, so two requests cannot both take the last free slot.
export async function assertWithinPlanLimit(
  client: PoolClient,
  tenantCode: string,
  resource: PlanResource,
): Promise<void> {
  const { table, limitColumn } = planResources[resource];
  const planResult = await client.query<{ plan_name: string; limit: number | null }>(
    `SELECT p.name AS plan_name, p.${limitColumn} AS limit
     FROM ${tenantPlan}
     WHERE ts.tenant_code = $1
     FOR UPDATE OF ts`,
    [tenantCode],
  );
  const plan = planResult.rows[0];
  if (!plan) throw new Error(`No subscription found for tenant ${tenantCode}.`);
  if (plan.limit === null) return;

  const countResult = await client.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE tenant_code = $1`,
    [tenantCode],
  );
  if (countResult.rows[0].count >= plan.limit) {
    throw new PlanLimitError(resource, plan.limit, plan.plan_name);
  }
}

// Runs create(client) in a transaction, only if the tenant is below its plan limit for the resource.
export async function withPlanLimit<T>(
  tenantCode: string,
  resource: PlanResource,
  create: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await assertWithinPlanLimit(client, tenantCode, resource);
    const result = await create(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Whether a customer can book now. Returns null when the tenant does not exist.
export async function isAcceptingTickets(tenantCode: string): Promise<boolean | null> {
  const result = await db.query<{ accepting: boolean }>(
    `SELECT p.max_tickets_per_day IS NULL
            OR COALESCE((SELECT tickets_created FROM tenant_daily_usage
                         WHERE tenant_code = ts.tenant_code AND usage_date = CURRENT_DATE), 0)
               < p.max_tickets_per_day AS accepting
     FROM ${tenantPlan}
     WHERE ts.tenant_code = $1`,
    [tenantCode],
  );
  return result.rows[0]?.accepting ?? null;
}

const dailyTicketLimit = `(SELECT p.max_tickets_per_day FROM ${tenantPlan} WHERE ts.tenant_code = $1)`;

// Sent with the tenant code when today's booking state changes: the first ticket of a day
// (the limit is open again) and the ticket that reaches the limit.
export const DAILY_LIMIT_CHANNEL = "daily_ticket_limit_changed";

// Counts one ticket against today's limit. Returns false, and counts nothing, when the limit is
// already reached or the tenant has no subscription. The check and the increment are one
// statement on one row, so concurrent bookings cannot go over the limit. Notifications are
// delivered only if the caller's transaction commits.
export async function consumeDailyTicket(client: PoolClient, tenantCode: string): Promise<boolean> {
  const result = await client.query<{ tickets_created: number; daily_limit: number | null }>(
    `INSERT INTO tenant_daily_usage AS u (tenant_code, usage_date, tickets_created)
     SELECT ts.tenant_code, CURRENT_DATE, 1
     FROM ${tenantPlan}
     WHERE ts.tenant_code = $1 AND (p.max_tickets_per_day IS NULL OR p.max_tickets_per_day > 0)
     ON CONFLICT (tenant_code, usage_date) DO UPDATE
       SET tickets_created = u.tickets_created + 1
       WHERE ${dailyTicketLimit} IS NULL OR u.tickets_created < ${dailyTicketLimit}
     RETURNING u.tickets_created, ${dailyTicketLimit} AS daily_limit`,
    [tenantCode],
  );
  const row = result.rows[0];
  if (!row) return false;

  if (row.tickets_created === 1 || row.tickets_created === row.daily_limit) {
    await client.query("SELECT pg_notify($1, $2)", [DAILY_LIMIT_CHANNEL, tenantCode]);
  }
  return true;
}
