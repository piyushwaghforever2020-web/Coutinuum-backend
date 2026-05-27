-- Employer-funded individual flow (PostgreSQL)

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS payment_type VARCHAR(32) NOT NULL DEFAULT 'self_pay',
  ADD COLUMN IF NOT EXISTS billing_manager_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS billing_manager_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS billing_address VARCHAR(255),
  ADD COLUMN IF NOT EXISTS billing_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS billing_zip_code VARCHAR(50);

ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_payment_type_check;

ALTER TABLE participants
  ADD CONSTRAINT participants_payment_type_check
  CHECK (payment_type IN ('self_pay', 'employer_funded'));

CREATE INDEX IF NOT EXISTS idx_participants_payment_type ON participants (payment_type);

CREATE TABLE IF NOT EXISTS stripe_customers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(150),
  stripe_customer_id VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seats (
  id BIGSERIAL PRIMARY KEY,
  participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  cohort_id BIGINT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  participant_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'locked',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_seats_participant_cohort UNIQUE (participant_id, cohort_id),
  CONSTRAINT seats_status_check CHECK (status IN ('locked', 'active', 'available', 'assigned'))
);

CREATE INDEX IF NOT EXISTS idx_seats_cohort_status ON seats (cohort_id, status);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  seat_id BIGINT NOT NULL UNIQUE REFERENCES seats(id) ON DELETE CASCADE,
  participant_id BIGINT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  cohort_id BIGINT NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_invoice_number VARCHAR(64),
  manager_name VARCHAR(150) NOT NULL,
  manager_email VARCHAR(255) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'usd',
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  hosted_invoice_url VARCHAR(2048),
  invoice_pdf_url VARCHAR(2048),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  stripe_event_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_status_check CHECK (
    status IN ('created', 'sent', 'paid', 'failed', 'refunded')
  )
);

CREATE INDEX IF NOT EXISTS idx_invoices_participant ON invoices (participant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cohort_status ON invoices (cohort_id, status);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) DEFAULT 'checkout',
  ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoices(id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_stripe_invoice_id
  ON payments (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

UPDATE participants SET payment_type = 'self_pay' WHERE payment_type IS NULL;
