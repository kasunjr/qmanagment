import type { Pool, PoolClient } from "pg";
import { db } from "@/lib/db";
import { isUuid } from "@/lib/staff-users";

export interface TicketRecord {
  id: string;
  ticket_number: number;
  customer_name: string;
  status: "waiting" | "serving" | "completed";
  branch_name: string;
  service_name: string;
  // The counter that called the ticket; null while waiting or when the counter has no name.
  counter_name: string | null;
  people_ahead: number;
  created_at: Date;
}

export interface TicketFields {
  customer_name: string;
  branch_id: string;
  service_id: string;
}

export function validateTicketFields(
  value: unknown,
): { fields: TicketFields; error?: never } | { fields?: never; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Request body must be a JSON object." };
  }

  const body = value as Record<string, unknown>;

  if (
    typeof body.customer_name !== "string" ||
    !body.customer_name.trim() ||
    body.customer_name.trim().length > 120
  ) {
    return { error: "Name must be between 1 and 120 characters." };
  }
  if (typeof body.branch_id !== "string" || !isUuid(body.branch_id)) {
    return { error: "Provide a valid branch ID." };
  }
  if (typeof body.service_id !== "string" || !isUuid(body.service_id)) {
    return { error: "Provide a valid service ID." };
  }

  return {
    fields: {
      customer_name: body.customer_name.trim(),
      branch_id: body.branch_id,
      service_id: body.service_id,
    },
  };
}

// Staff counters listen on this channel; the payload is the branch ID whose tickets changed.
export const BRANCH_TICKETS_CHANNEL = "branch_tickets_changed";

export async function notifyBranchTicketsChanged(client: Pool | PoolClient, branchId: string): Promise<void> {
  await client.query("SELECT pg_notify($1, $2)", [BRANCH_TICKETS_CHANNEL, branchId]);
}

// Returns null when the ticket is not in the tenant or is from a previous day.
export async function getTicket(tenantCode: string, ticketId: string): Promise<TicketRecord | null> {
  const result = await db.query<TicketRecord>(
    `SELECT t.id, t.ticket_number, t.customer_name, t.status,
            b.name AS branch_name, s.name AS service_name, t.counter_name,
            (SELECT COUNT(*)::int FROM tickets ahead
             WHERE ahead.branch_id = t.branch_id AND ahead.service_id = t.service_id
               AND ahead.ticket_date = t.ticket_date
               AND ahead.status = 'waiting' AND ahead.ticket_number < t.ticket_number) AS people_ahead,
            t.created_at
     FROM tickets t
     JOIN branches b ON b.id = t.branch_id
     JOIN services s ON s.id = t.service_id
     WHERE t.id = $2 AND t.tenant_code = $1 AND t.ticket_date = CURRENT_DATE`,
    [tenantCode, ticketId],
  );
  return result.rows[0] ?? null;
}

// Returns null when the branch or service does not belong to the tenant, or no counter in
// the branch serves the service.
// Pass a client to create the ticket inside the caller's transaction.
export async function createTicket(
  tenantCode: string,
  fields: TicketFields,
  client: Pool | PoolClient = db,
): Promise<TicketRecord | null> {
  // One statement: the branch and service are checked, the branch's daily counter is bumped,
  // and the ticket is saved with that number, so a number is never taken without its ticket.
  const result = await client.query<TicketRecord>(
    `WITH target AS (
       SELECT b.id AS branch_id, b.tenant_code, b.name AS branch_name, s.name AS service_name
       FROM branches b
       JOIN services s ON s.id = $3 AND s.tenant_code = b.tenant_code
       WHERE b.id = $2 AND b.tenant_code = $1
         AND EXISTS (
           SELECT 1 FROM staff_users su
           JOIN staff_user_services sus ON sus.staff_user_id = su.id
           WHERE su.branch_id = b.id AND sus.service_id = s.id
         )
     ), counter AS (
       INSERT INTO ticket_counters (branch_id, ticket_date, last_number)
       SELECT branch_id, CURRENT_DATE, 1 FROM target
       ON CONFLICT (branch_id, ticket_date)
       DO UPDATE SET last_number = ticket_counters.last_number + 1
       RETURNING last_number
     ), ticket AS (
       INSERT INTO tickets (tenant_code, branch_id, service_id, customer_name, ticket_number)
       SELECT target.tenant_code, target.branch_id, $3, $4, counter.last_number
       FROM target, counter
       RETURNING id, branch_id, service_id, ticket_number, ticket_date, customer_name, status,
                 counter_name, created_at
     ), notified AS (
       SELECT pg_notify('${BRANCH_TICKETS_CHANNEL}', ticket.branch_id::text)
       FROM ticket
     )
     SELECT ticket.id, ticket.ticket_number, ticket.customer_name, ticket.status,
            target.branch_name, target.service_name, ticket.counter_name,
            -- The new ticket is not visible to this count, so it only sees those already waiting.
            (SELECT COUNT(*)::int FROM tickets t
             WHERE t.branch_id = ticket.branch_id AND t.service_id = ticket.service_id
               AND t.ticket_date = ticket.ticket_date AND t.status = 'waiting') AS people_ahead,
            ticket.created_at
    FROM ticket, target, notified`,
    [tenantCode, fields.branch_id, fields.service_id, fields.customer_name],
  );
  return result.rows[0] ?? null;
}

export interface CounterTicket {
  id: string;
  ticket_number: number;
  customer_name: string;
  service_name: string;
  status: "waiting" | "serving" | "completed";
  created_at: Date;
}

export async function getCounterTicket(client: PoolClient, ticketId: string): Promise<CounterTicket | null> {
  const result = await client.query<CounterTicket>(
    `SELECT t.id, t.ticket_number, t.customer_name, s.name AS service_name,
            t.status, t.created_at
     FROM tickets t
     JOIN services s ON s.id = t.service_id AND s.tenant_code = t.tenant_code
     WHERE t.id = $1`,
    [ticketId],
  );
  return result.rows[0] ?? null;
}

export interface LockedCounter {
  id: string;
  tenant_code: string;
  branch_id: string;
  counter_name: string | null;
}

// Locks the staff user's row so one counter cannot call or complete twice at the same time.
// Returns null when the staff user has no branch.
export async function lockCounter(client: PoolClient, staffUserId: string, tenantCode: string): Promise<LockedCounter | null> {
  const result = await client.query<LockedCounter>(
    `SELECT id, tenant_code, branch_id, counter_name FROM staff_users
     WHERE id = $1 AND tenant_code = $2 AND branch_id IS NOT NULL
     FOR UPDATE`,
    [staffUserId, tenantCode],
  );
  return result.rows[0] ?? null;
}

// Calls the longest-waiting ticket in the counter's branch among the services it serves.
// SKIP LOCKED lets two counters call at the same moment without taking the same ticket.
export async function callNextTicket(client: PoolClient, counter: LockedCounter): Promise<string | null> {
  const nextResult = await client.query<{ id: string }>(
    `SELECT t.id FROM tickets t
     JOIN staff_user_services sus ON sus.service_id = t.service_id AND sus.staff_user_id = $1
     WHERE t.tenant_code = $2 AND t.branch_id = $3 AND t.ticket_date = CURRENT_DATE AND t.status = 'waiting'
     ORDER BY t.created_at, t.ticket_number
     LIMIT 1 FOR UPDATE OF t SKIP LOCKED`,
    [counter.id, counter.tenant_code, counter.branch_id],
  );
  const ticketId = nextResult.rows[0]?.id;
  if (!ticketId) return null;

  await client.query(
    `UPDATE tickets SET status = 'serving', served_by = $2, counter_name = $3, updated_at = NOW()
     WHERE id = $1`,
    [ticketId, counter.id, counter.counter_name],
  );
  return ticketId;
}
