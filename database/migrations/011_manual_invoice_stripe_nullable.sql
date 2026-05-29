-- Manual sponsorship invoices are created before Stripe (PostgreSQL)

ALTER TABLE invoices
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE invoices
  ALTER COLUMN stripe_invoice_id DROP NOT NULL;

ALTER TABLE sponsorships
  ADD COLUMN IF NOT EXISTS message TEXT;
