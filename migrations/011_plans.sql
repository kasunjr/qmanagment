-- What each plan allows. NULL in a max_* column means unlimited.
CREATE TABLE plans (
    code TEXT PRIMARY KEY CHECK (code ~ '^[a-z_]{1,30}$'),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    price_label TEXT NOT NULL,
    max_branches INTEGER CHECK (max_branches >= 0),
    max_services INTEGER CHECK (max_services >= 0),
    max_queues INTEGER CHECK (max_queues >= 0),
    max_staff_users INTEGER CHECK (max_staff_users >= 0),
    max_tickets_per_day INTEGER CHECK (max_tickets_per_day >= 0),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (code, name, price_label, max_branches, max_services, max_queues,
                   max_staff_users, max_tickets_per_day, sort_order) VALUES
    ('basic', 'Basic', 'Free', 1, 1, 1, 1, 10, 1),
    ('pro', 'Pro', '$9/mo', 20, 20, 20, 20, 1000, 2),
    ('enterprise', 'Enterprise', 'Custom', NULL, NULL, NULL, NULL, NULL, 3);

-- One subscription per tenant, kept apart from the login data in users.
CREATE TABLE tenant_subscriptions (
    tenant_code VARCHAR(7) PRIMARY KEY REFERENCES users(tenant_code) ON DELETE CASCADE,
    plan_code TEXT NOT NULL DEFAULT 'basic' REFERENCES plans(code),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tenant_subscriptions_plan_code_idx ON tenant_subscriptions(plan_code);

-- Existing accounts start on the basic plan.
INSERT INTO tenant_subscriptions (tenant_code)
SELECT tenant_code FROM users;

-- New accounts get a basic subscription in the same transaction as the signup.
CREATE FUNCTION create_default_subscription() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tenant_subscriptions (tenant_code) VALUES (NEW.tenant_code);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_default_subscription
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Tickets created per tenant per day. Not tied to branches, so deleting a branch does not reset the day's count; ticket_counters still does numbering.
CREATE TABLE tenant_daily_usage (
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    tickets_created INTEGER NOT NULL DEFAULT 0 CHECK (tickets_created >= 0),
    PRIMARY KEY (tenant_code, usage_date)
);
