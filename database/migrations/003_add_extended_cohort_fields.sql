ALTER TABLE cohorts
ADD COLUMN leave_with JSON NULL AFTER refund_policy,
ADD COLUMN live_sessions_text VARCHAR(500) NULL AFTER leave_with,
ADD COLUMN workshops_text VARCHAR(500) NULL AFTER live_sessions_text,
ADD COLUMN cohort_size_text VARCHAR(500) NULL AFTER workshops_text,
ADD COLUMN investment_tiers JSON NULL AFTER cohort_size_text,
ADD COLUMN scarcity_text TEXT NULL AFTER investment_tiers,
ADD COLUMN display_price VARCHAR(255) NULL AFTER scarcity_text;
