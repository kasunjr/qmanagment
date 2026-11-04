-- A staff user is a counter: it belongs to one branch and serves any number of services.
-- Tickets wait per branch and service, and any counter serving that service can call them.
ALTER TABLE staff_users
    ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    ADD COLUMN counter_name TEXT CHECK (
        counter_name IS NULL OR (btrim(counter_name) <> '' AND char_length(counter_name) <= 60)
    );

CREATE INDEX staff_users_branch_id_idx ON staff_users(branch_id);

CREATE TABLE staff_user_services (
    staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (staff_user_id, service_id)
);

CREATE INDEX staff_user_services_service_id_idx ON staff_user_services(service_id);

-- counter_name is copied when the ticket is called, so it survives later staff changes.
ALTER TABLE tickets
    ADD COLUMN served_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    ADD COLUMN counter_name TEXT;

-- Existing staff keep their queue's branch and services.
UPDATE staff_users su
SET branch_id = q.branch_id
FROM staff_user_queues suq
JOIN queues q ON q.id = suq.queue_id
WHERE suq.staff_user_id = su.id;

INSERT INTO staff_user_services (staff_user_id, service_id)
SELECT suq.staff_user_id, qs.service_id
FROM staff_user_queues suq
JOIN queue_services qs ON qs.queue_id = suq.queue_id
ON CONFLICT DO NOTHING;

-- A serving ticket belongs to the staff user of its queue. Today's serving tickets in a queue
-- with no staff user could never be completed, so they go back to waiting.
UPDATE tickets t
SET served_by = suq.staff_user_id
FROM staff_user_queues suq
WHERE suq.queue_id = t.queue_id AND t.status = 'serving';

UPDATE tickets
SET status = 'waiting', updated_at = NOW()
WHERE status = 'serving' AND served_by IS NULL AND ticket_date = CURRENT_DATE;

-- A counter serves one ticket at a time.
CREATE UNIQUE INDEX tickets_one_serving_per_staff_idx
    ON tickets(served_by, ticket_date) WHERE status = 'serving';

CREATE INDEX tickets_branch_status_idx ON tickets(branch_id, ticket_date, status);

ALTER TABLE tickets DROP COLUMN queue_id;

DROP TABLE staff_user_queues;
DROP TABLE queue_services;
DROP TABLE queues;

ALTER TABLE plans DROP COLUMN max_queues;
