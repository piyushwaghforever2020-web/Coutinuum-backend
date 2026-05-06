ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS answers JSON NULL AFTER cohort_id;

ALTER TABLE participants
  MODIFY COLUMN payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending';

ALTER TABLE participants
  ADD UNIQUE KEY uq_participants_email_cohort (email, cohort_id);

ALTER TABLE payments
  MODIFY COLUMN status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255) NULL AFTER transaction_id,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255) NULL AFTER stripe_checkout_session_id,
  ADD COLUMN IF NOT EXISTS checkout_url VARCHAR(2048) NULL AFTER stripe_payment_intent_id,
  ADD COLUMN IF NOT EXISTS completed_at DATETIME NULL AFTER checkout_url;

ALTER TABLE payments
  ADD UNIQUE KEY uq_payments_stripe_checkout_session_id (stripe_checkout_session_id),
  ADD UNIQUE KEY uq_payments_stripe_payment_intent_id (stripe_payment_intent_id);

UPDATE participants
SET payment_status = 'pending'
WHERE payment_status IS NULL OR payment_status = '';

UPDATE cohorts c
LEFT JOIN (
  SELECT cohort_id, COUNT(*) AS enrolled_count
  FROM participants
  WHERE payment_status = 'paid' AND registration_status = 'complete'
  GROUP BY cohort_id
) p ON p.cohort_id = c.id
SET c.seats_filled = COALESCE(p.enrolled_count, 0),
    c.status = CASE
      WHEN c.status = 'closed' THEN 'closed'
      WHEN COALESCE(p.enrolled_count, 0) >= c.seat_limit THEN 'full'
      ELSE 'active'
    END;
