CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(7) NOT NULL REFERENCES users(tenant_code) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    code TEXT NOT NULL CHECK (btrim(code) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_code, code)
);

CREATE INDEX branches_tenant_code_idx ON branches(tenant_code);
