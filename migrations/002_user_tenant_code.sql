ALTER TABLE users
    ADD COLUMN tenant_code VARCHAR(7) NOT NULL
    DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))
    UNIQUE
    CHECK (tenant_code ~ '^[A-F0-9]{7}$');