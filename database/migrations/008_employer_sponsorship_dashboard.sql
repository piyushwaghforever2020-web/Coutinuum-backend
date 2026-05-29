-- Employer sponsorship dashboard (PostgreSQL)

-- Seats: support sponsorship-held seats without a participant yet
ALTER TABLE seats
  DROP CONSTRAINT IF EXISTS seats_status_check;

ALTER TABLE seats
  ALTER COLUMN participant_id DROP NOT NULL,
  ALTER COLUMN participant_email DROP NOT NULL;

ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS sponsorship_id BIGINT,
  ADD COLUMN IF NOT EXISTS program_id BIGINT,
  ADD COLUMN IF NOT EXISTS assigned_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS hold_expires_at TIMESTAMPTZ;

ALTER TABLE seats
  ADD CONSTRAINT seats_status_check
  CHECK (status IN ('locked', 'active', 'available', 'assigned', 'released'));

CREATE TABLE IF NOT EXISTS employer_users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  company_name VARCHAR(150),
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsorships (
  id BIGSERIAL PRIMARY KEY,
  employer_user_id BIGINT NOT NULL REFERENCES employer_users(id) ON DELETE RESTRICT,
  cohort_id BIGINT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'invoice_requested',
  total_seats INTEGER NOT NULL,
  used_seats INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  stripe_customer_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255) UNIQUE,
  invoice_id BIGINT,
  hosted_invoice_url VARCHAR(2048),
  invoice_pdf_url VARCHAR(2048),
  invoice_due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  stripe_event_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sponsorships_status_check CHECK (
    status IN (
      'invoice_requested',
      'pending_payment',
      'paid',
      'failed',
      'voided',
      'cancelled'
    )
  ),
  CONSTRAINT sponsorships_total_seats_check CHECK (total_seats > 0),
  CONSTRAINT sponsorships_used_seats_check CHECK (used_seats >= 0)
);

-- Deferred FK: sponsorships and invoices reference each other
ALTER TABLE sponsorships
  DROP CONSTRAINT IF EXISTS sponsorships_invoice_fk;

ALTER TABLE sponsorships
  ADD CONSTRAINT sponsorships_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE seats
  DROP CONSTRAINT IF EXISTS seats_sponsorship_fk;

ALTER TABLE seats
  ADD CONSTRAINT seats_sponsorship_fk
  FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE CASCADE;

ALTER TABLE seats
  DROP CONSTRAINT IF EXISTS seats_program_fk;

ALTER TABLE seats
  ADD CONSTRAINT seats_program_fk
  FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ALTER COLUMN seat_id DROP NOT NULL,
  ALTER COLUMN participant_id DROP NOT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS employer_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS sponsorship_id BIGINT;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_employer_user_fk;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_employer_user_fk
  FOREIGN KEY (employer_user_id) REFERENCES employer_users(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_sponsorship_fk;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_sponsorship_fk
  FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE SET NULL;

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check CHECK (
    status IN (
      'invoice_requested',
      'invoice_sent',
      'created',
      'sent',
      'paid',
      'failed',
      'refunded'
    )
  );

ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS employer_user_id BIGINT,
  ADD COLUMN IF NOT EXISTS sponsorship_id BIGINT;

ALTER TABLE magic_link_tokens
  DROP CONSTRAINT IF EXISTS magic_link_tokens_employer_user_fk;

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_employer_user_fk
  FOREIGN KEY (employer_user_id) REFERENCES employer_users(id) ON DELETE CASCADE;

ALTER TABLE magic_link_tokens
  DROP CONSTRAINT IF EXISTS magic_link_tokens_sponsorship_fk;

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_sponsorship_fk
  FOREIGN KEY (sponsorship_id) REFERENCES sponsorships(id) ON DELETE CASCADE;

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_employer_users_email ON employer_users (email);
CREATE INDEX IF NOT EXISTS idx_sponsorships_employer ON sponsorships (employer_user_id);
CREATE INDEX IF NOT EXISTS idx_sponsorships_cohort_status ON sponsorships (cohort_id, status);
CREATE INDEX IF NOT EXISTS idx_sponsorships_stripe_invoice ON sponsorships (stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_seats_sponsorship_status ON seats (sponsorship_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_program_status ON seats (program_id, status);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_employer ON magic_link_tokens (employer_user_id);
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_sponsorship ON magic_link_tokens (sponsorship_id);
