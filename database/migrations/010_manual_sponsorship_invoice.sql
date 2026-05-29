-- Manual sponsorship invoice + category (PostgreSQL)

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS is_manual_invoice BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sponsorships
  ADD COLUMN IF NOT EXISTS sponsership_category VARCHAR(200);

ALTER TABLE sponsorships
  DROP CONSTRAINT IF EXISTS sponsorships_category_check;

ALTER TABLE sponsorships
  ADD CONSTRAINT sponsorships_category_check CHECK (
    sponsership_category IS NULL
    OR sponsership_category IN ('individual', 'block_seats', 'private_cohort')
  );
