ALTER TABLE staff_users
    ADD CONSTRAINT staff_users_id_tenant_code_unique UNIQUE (id, tenant_code);

ALTER TABLE queues
    ADD CONSTRAINT queues_id_tenant_code_unique UNIQUE (id, tenant_code);

CREATE TABLE staff_user_queues (
    tenant_code VARCHAR(7) NOT NULL,
    staff_user_id UUID NOT NULL,
    queue_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (staff_user_id, queue_id),
    FOREIGN KEY (staff_user_id, tenant_code)
        REFERENCES staff_users(id, tenant_code) ON DELETE CASCADE,
    FOREIGN KEY (queue_id, tenant_code)
        REFERENCES queues(id, tenant_code) ON DELETE CASCADE
);

CREATE INDEX staff_user_queues_queue_id_idx ON staff_user_queues(queue_id);
