CREATE TABLE staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    username TEXT NOT NULL CHECK (btrim(username) <> ''),
    email TEXT NOT NULL CHECK (btrim(email) <> ''),
    role TEXT NOT NULL DEFAULT 'Agent' CHECK (btrim(role) <> ''),
    code_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_code, username),
    UNIQUE (tenant_code, email)
);

CREATE INDEX staff_users_tenant_code_idx ON staff_users(tenant_code);
