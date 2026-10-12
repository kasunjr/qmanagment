-- One row per branch per day, holding the last ticket number handed out.
CREATE TABLE ticket_counters (
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    ticket_date DATE NOT NULL,
    last_number INTEGER NOT NULL,
    PRIMARY KEY (branch_id, ticket_date)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL CHECK (btrim(customer_name) <> ''),
    ticket_number INTEGER NOT NULL,
    ticket_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'serving', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, ticket_date, ticket_number)
);

CREATE INDEX tickets_tenant_code_idx ON tickets(tenant_code);
CREATE INDEX tickets_queue_status_idx ON tickets(queue_id, ticket_date, status);
