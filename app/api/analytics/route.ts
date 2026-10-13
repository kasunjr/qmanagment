import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyticsRecord {
  serving_count: number;
  average_serving_minutes: number;
  waiting_count: number;
  min_wait_minutes: number | null;
  max_wait_minutes: number | null;
  waiting_by_hour: { label: string; customers: number }[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const result = await db.query<AnalyticsRecord>(
      `WITH todays_tickets AS (
         SELECT t.status, t.created_at, s.duration_minutes
         FROM tickets t
         LEFT JOIN services s ON s.id = t.service_id
         WHERE t.tenant_code = $1 AND t.ticket_date = CURRENT_DATE
       ), waiting_counts AS (
         SELECT EXTRACT(HOUR FROM created_at)::int AS hour_of_day,
                COUNT(*)::int AS customers
         FROM todays_tickets
         WHERE status = 'waiting'
           AND EXTRACT(HOUR FROM created_at) BETWEEN 8 AND 20
         GROUP BY 1
       )
       SELECT
         COUNT(*) FILTER (WHERE status = 'serving')::int AS serving_count,
         COALESCE(ROUND(AVG(duration_minutes) FILTER (WHERE status = 'serving')), 0)::int AS average_serving_minutes,
         COUNT(*) FILTER (WHERE status = 'waiting')::int AS waiting_count,
         MIN(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)
           FILTER (WHERE status = 'waiting')::float8 AS min_wait_minutes,
         MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)
           FILTER (WHERE status = 'waiting')::float8 AS max_wait_minutes,
         (SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
              'label', CASE
                WHEN hours.hour_of_day = 12 THEN '12 PM'
                WHEN hours.hour_of_day < 12 THEN hours.hour_of_day::text || ' AM'
                ELSE (hours.hour_of_day - 12)::text || ' PM'
              END,
              'customers', COALESCE(waiting_counts.customers, 0)
            ) ORDER BY hours.hour_of_day
          )
          FROM GENERATE_SERIES(8, 20) AS hours(hour_of_day)
          LEFT JOIN waiting_counts USING (hour_of_day)) AS waiting_by_hour
       FROM todays_tickets`,
      [user.tenant_code],
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Analytics retrieval failed:", error);
    return NextResponse.json(
      { error: "Unable to retrieve analytics." },
      { status: 500 },
    );
  }
}
