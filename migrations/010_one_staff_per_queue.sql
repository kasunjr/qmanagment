WITH ranked_assignments AS (
    SELECT
        ctid,
        ROW_NUMBER() OVER (
            PARTITION BY queue_id
            ORDER BY created_at, staff_user_id
        ) AS assignment_rank
    FROM staff_user_queues
)
DELETE FROM staff_user_queues suq
USING ranked_assignments ranked
WHERE suq.ctid = ranked.ctid
  AND ranked.assignment_rank > 1;

CREATE UNIQUE INDEX staff_user_queues_one_staff_per_queue_idx
    ON staff_user_queues(queue_id);
