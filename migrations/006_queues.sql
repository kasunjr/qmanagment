CREATE TABLE queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, name),
    UNIQUE (id, branch_id)
);

CREATE INDEX queues_tenant_code_idx ON queues(tenant_code);
CREATE UNIQUE INDEX queues_one_default_per_branch_idx ON queues(branch_id) WHERE is_default;

-- Holds only non-default assignments: a service with no row for a branch
-- belongs to that branch's default queue.
CREATE TABLE queue_services (
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    queue_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (branch_id, service_id),
    FOREIGN KEY (queue_id, branch_id) REFERENCES queues(id, branch_id)
);

CREATE INDEX queue_services_queue_id_idx ON queue_services(queue_id);
