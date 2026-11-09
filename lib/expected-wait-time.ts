import type { Pool, PoolClient } from "pg";

export interface SimulationCounter {
  id: string;
  service_ids: string[];
  busy_seconds: number;
}

export interface SimulationTicket {
  service_id: string;
  duration_minutes: number;
}

export interface QueueEstimate {
  people_ahead: number;
  estimated_wait_minutes: number | null;
}

// Pure: `ahead` must be the waiting tickets before this one, in call order.
export function simulateQueue(
  serviceId: string,
  counters: SimulationCounter[],
  ahead: SimulationTicket[],
): QueueEstimate {
  const myCounters = counters.filter((counter) => counter.service_ids.includes(serviceId));
  if (myCounters.length === 0) {
    return {
      people_ahead: ahead.filter((ticket) => ticket.service_id === serviceId).length,
      estimated_wait_minutes: null,
    };
  }

  const freeAt = new Map(counters.map((counter) => [counter.id, Math.max(0, counter.busy_seconds)]));
  // The earliest-free counter takes the ticket. On a tie, the counter with fewer services goes
  // first, leaving the wider counters for the services only they can serve.
  const pickCounter = (candidates: SimulationCounter[]) =>
    candidates.reduce((best, counter) => {
      const diff = freeAt.get(counter.id)! - freeAt.get(best.id)!;
      if (diff < 0 || (diff === 0 && counter.service_ids.length < best.service_ids.length)) return counter;
      return best;
    });

  let peopleAhead = 0;
  for (const ticket of ahead) {
    const eligible = counters.filter((counter) => counter.service_ids.includes(ticket.service_id));
    if (eligible.length === 0) continue; // Nobody can call it, so it never holds a counter.
    if (eligible.some((counter) => myCounters.includes(counter))) peopleAhead++;
    const counter = pickCounter(eligible);
    freeAt.set(counter.id, freeAt.get(counter.id)! + ticket.duration_minutes * 60);
  }

  const waitSeconds = freeAt.get(pickCounter(myCounters).id)!;
  return { people_ahead: peopleAhead, estimated_wait_minutes: Math.ceil(waitSeconds / 60) };
}

interface EstimateRow {
  service_id: string;
  counters: SimulationCounter[];
  ahead: SimulationTicket[];
}

// Loads the ticket's branch queue in one query and simulates it. Returns null when the ticket
// does not exist. Pass the caller's client to see a ticket created in its open transaction.
export async function getQueueEstimate(
  client: Pool | PoolClient,
  ticketId: string,
): Promise<QueueEstimate | null> {
  const result = await client.query<EstimateRow>(
    `WITH me AS (
       SELECT branch_id, service_id, ticket_date, created_at, ticket_number FROM tickets WHERE id = $1
     )
     SELECT me.service_id,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', su.id,
                       'service_ids', ARRAY(SELECT sus.service_id FROM staff_user_services sus
                                            WHERE sus.staff_user_id = su.id),
                       -- A serving ticket keeps its call time in updated_at until it is completed.
                       'busy_seconds', COALESCE((
                         SELECT GREATEST(0, s.duration_minutes * 60 - EXTRACT(EPOCH FROM NOW() - t.updated_at))
                         FROM tickets t JOIN services s ON s.id = t.service_id
                         WHERE t.served_by = su.id AND t.status = 'serving' AND t.ticket_date = me.ticket_date
                         LIMIT 1), 0)
                     ) ORDER BY su.created_at, su.id)
              FROM staff_users su
              WHERE su.branch_id = me.branch_id AND su.is_enabled
            ), '[]') AS counters,
            COALESCE((
              SELECT json_agg(json_build_object('service_id', t.service_id, 'duration_minutes', s.duration_minutes)
                              ORDER BY t.created_at, t.ticket_number)
              FROM tickets t JOIN services s ON s.id = t.service_id
              WHERE t.branch_id = me.branch_id AND t.ticket_date = me.ticket_date AND t.status = 'waiting'
                AND (t.created_at, t.ticket_number) < (me.created_at, me.ticket_number)
            ), '[]') AS ahead
     FROM me`,
    [ticketId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return simulateQueue(
    row.service_id,
    row.counters.map((counter) => ({ ...counter, busy_seconds: Number(counter.busy_seconds) })),
    row.ahead,
  );
}
