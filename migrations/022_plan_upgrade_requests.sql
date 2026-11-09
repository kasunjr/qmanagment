-- Requests from tenants to move to a paid plan. There is no payment gateway: the tenant pays
-- offline and an operator approves the request, which then updates tenant_subscriptions.
CREATE TABLE plan_upgrade_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    -- Basic is the free plan every account starts on, so it is never requested.
    plan_code TEXT NOT NULL REFERENCES plans(code) CHECK (plan_code <> 'basic'),
    note TEXT CHECK (char_length(note) <= 500),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Set when the request leaves pending, whoever closes it.
    decided_at TIMESTAMPTZ,
    CHECK ((status = 'pending') = (decided_at IS NULL))
);

-- At most one open request per tenant, so repeated clicks cannot pile up requests.
CREATE UNIQUE INDEX plan_upgrade_requests_one_pending_idx
    ON plan_upgrade_requests (tenant_code) WHERE status = 'pending';

-- For loading a tenant's latest request.
CREATE INDEX plan_upgrade_requests_tenant_created_idx
    ON plan_upgrade_requests (tenant_code, created_at DESC);
