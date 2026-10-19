CREATE TABLE tenant_themes (
    tenant_code VARCHAR(7) PRIMARY KEY REFERENCES users(tenant_code) ON DELETE CASCADE,
    app_name TEXT NOT NULL CHECK (char_length(btrim(app_name)) BETWEEN 1 AND 60),
    logo_data BYTEA CHECK (octet_length(logo_data) <= 1048576),
    logo_mime_type TEXT CHECK (logo_mime_type IN ('image/png', 'image/jpeg', 'image/svg+xml', 'image/webp')),
    primary_color CHAR(7) NOT NULL CHECK (primary_color ~ '^#[0-9a-f]{6}$'),
    secondary_color CHAR(7) NOT NULL CHECK (secondary_color ~ '^#[0-9a-f]{6}$'),
    background_color CHAR(7) NOT NULL CHECK (background_color ~ '^#[0-9a-f]{6}$'),
    surface_color CHAR(7) NOT NULL CHECK (surface_color ~ '^#[0-9a-f]{6}$'),
    text_color CHAR(7) NOT NULL CHECK (text_color ~ '^#[0-9a-f]{6}$'),
    font_family TEXT NOT NULL CHECK (font_family IN ('system', 'serif', 'rounded', 'mono')),
    corner_radius TEXT NOT NULL CHECK (corner_radius IN ('none', 'small', 'medium', 'large')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((logo_data IS NULL) = (logo_mime_type IS NULL))
);
