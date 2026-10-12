import { db } from "@/lib/db";
import { serviceInQueue } from "@/lib/queues";
import { isUuid } from "@/lib/staff-users";

export interface TicketRecord {
  id: string;
  ticket_number: number;
  customer_name: string;
  status: "waiting" | "serving" | "completed";
  branch_name: string;
  service_name: string;
  queue_name: string;
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

// Returns null when the ticket is not in the tenant or is from a previous day.
export async function getTicket(tenantCode: string, ticketId: string): Promise<TicketRecord | null> {
  const result = await db.query<TicketRecord>(
    `SELECT t.id, t.ticket_number, t.customer_name, t.status,
            b.name AS branch_name, s.name AS service_name, q.name AS queue_name,
            (SELECT COUNT(*)::int FROM tickets ahead
             WHERE ahead.queue_id = t.queue_id AND ahead.ticket_date = t.ticket_date
               AND ahead.status = 'waiting' AND ahead.ticket_number < t.ticket_number) AS people_ahead,
            t.created_at
     FROM tickets t
     JOIN branches b ON b.id = t.branch_id
     JOIN services s ON s.id = t.service_id
     JOIN queues q ON q.id = t.queue_id
     WHERE t.id = $2 AND t.tenant_code = $1 AND t.ticket_date = CURRENT_DATE`,
    [tenantCode, ticketId],
  );
  return result.rows[0] ?? null;
}

// Returns null when the branch or service does not belong to the tenant.
export async function createTicket(
  tenantCode: string,
  fields: TicketFields,
): Promise<TicketRecord | null> {
  // One statement: the queue is resolved, the branch's daily counter is bumped, and the
  // ticket is saved with that number, so a number is never taken without its ticket.
  const result = await db.query<TicketRecord>(
    `WITH target AS (
       SELECT q.id AS queue_id, q.name AS queue_name, q.branch_id, q.tenant_code,
              b.name AS branch_name, s.name AS service_name
       FROM queues q
       JOIN branches b ON b.id = q.branch_id
       JOIN services s ON s.id = $3 AND s.tenant_code = q.tenant_code
       LEFT JOIN queue_services qs ON qs.service_id = s.id AND qs.branch_id = q.branch_id
       WHERE q.branch_id = $2 AND q.tenant_code = $1 AND ${serviceInQueue}
     ), counter AS (
       INSERT INTO ticket_counters (branch_id, ticket_date, last_number)
       SELECT branch_id, CURRENT_DATE, 1 FROM target
       ON CONFLICT (branch_id, ticket_date)
       DO UPDATE SET last_number = ticket_counters.last_number + 1
       RETURNING last_number
     ), ticket AS (
       INSERT INTO tickets (tenant_code, branch_id, service_id, queue_id, customer_name, ticket_number)
       SELECT target.tenant_code, target.branch_id, $3, target.queue_id, $4, counter.last_number
       FROM target, counter
       RETURNING id, queue_id, ticket_number, ticket_date, customer_name, status, created_at
     )
     SELECT ticket.id, ticket.ticket_number, ticket.customer_name, ticket.status,
            target.branch_name, target.service_name, target.queue_name,
            -- The new ticket is not visible to this count, so it only sees those already waiting.
            (SELECT COUNT(*)::int FROM tickets t
             WHERE t.queue_id = ticket.queue_id AND t.ticket_date = ticket.ticket_date
               AND t.status = 'waiting') AS people_ahead,
            ticket.created_at
     FROM ticket, target`,
    [tenantCode, fields.branch_id, fields.service_id, fields.customer_name],
  );
  return result.rows[0] ?? null;
}
