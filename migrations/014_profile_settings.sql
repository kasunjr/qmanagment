ALTER TABLE users
    ADD COLUMN display_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN two_step_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN account_updates_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN password_changed_at TIMESTAMPTZ;

CREATE TABLE email_change_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    new_email TEXT NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_change_codes_user_created_at_idx
    ON email_change_codes(user_id, created_at DESC);

CREATE INDEX email_change_codes_expires_at_idx
    ON email_change_codes(expires_at);
