WITH ranked_assignments AS (
    SELECT
        ctid,
        ROW_NUMBER() OVER (
            PARTITION BY staff_user_id
            ORDER BY created_at, queue_id
        ) AS assignment_rank
    FROM staff_user_queues
)
DELETE FROM staff_user_queues suq
USING ranked_assignments ranked
WHERE suq.ctid = ranked.ctid
  AND ranked.assignment_rank > 1;

CREATE UNIQUE INDEX staff_user_queues_one_queue_per_staff_idx
    ON staff_user_queues(staff_user_id);
