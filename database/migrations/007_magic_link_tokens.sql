-- Magic link tokens table (PostgreSQL)
-- Stores hashed tokens for passwordless email-based authentication

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(128) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'participant',
  participant_id BIGINT REFERENCES participants(id) ON DELETE CASCADE,
  cohort_id BIGINT REFERENCES cohorts(id) ON DELETE SET NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT magic_link_tokens_role_check CHECK (role IN ('participant', 'employer')),
  CONSTRAINT magic_link_tokens_purpose_check CHECK (purpose IN ('login', 'file_download', 'dashboard_access'))
);

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email ON magic_link_tokens (email);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_expires_at ON magic_link_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_participant ON magic_link_tokens (participant_id);

