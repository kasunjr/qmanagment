CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK (duration_minutes BETWEEN 1 AND 1440),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_code, name)
);

CREATE INDEX services_tenant_code_idx ON services(tenant_code);
