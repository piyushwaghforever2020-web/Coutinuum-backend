CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  token_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_token_id (token_id),
  UNIQUE KEY uq_admin_sessions_token_hash (token_hash),
  KEY idx_admin_sessions_admin_id (admin_id),
  KEY idx_admin_sessions_expires_at (expires_at),
  KEY idx_admin_sessions_revoked_at (revoked_at),
  CONSTRAINT fk_admin_sessions_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cohorts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  price DECIMAL(10, 2) NOT NULL,
  seat_limit INT NOT NULL,
  seats_filled INT NOT NULL DEFAULT 0,
  status ENUM('active', 'full', 'closed') NOT NULL DEFAULT 'active',
  refund_policy TEXT NULL,
  leave_with JSON NULL,
  live_sessions_text VARCHAR(500) NULL,
  workshops_text VARCHAR(500) NULL,
  cohort_size_text VARCHAR(500) NULL,
  investment_tiers JSON NULL,
  scarcity_text TEXT NULL,
  display_price VARCHAR(255) NULL,
  has_multi_program TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cohorts_name (name),
  KEY idx_cohorts_status (status),
  KEY idx_cohorts_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cohort_programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cohort_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NOT NULL,
  allocated_seats INT NOT NULL DEFAULT 0,
  seats_filled INT NOT NULL DEFAULT 0,
  is_full TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cohort_programs_cohort_id (cohort_id),
  KEY idx_cohort_programs_program_id (program_id),
  UNIQUE KEY uq_cohort_program (cohort_id, program_id),
  CONSTRAINT fk_cohort_programs_cohort
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_cohort_programs_program
    FOREIGN KEY (program_id) REFERENCES programs(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  company VARCHAR(150) NULL,
  role VARCHAR(150) NULL,
  cohort_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NULL,
  answers JSON NULL,
  payment_status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  registration_status ENUM('complete', 'incomplete') NOT NULL DEFAULT 'incomplete',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_participants_cohort_id (cohort_id),
  KEY idx_participants_program_id (program_id),
  KEY idx_participants_email (email),
  KEY idx_participants_payment_status (payment_status),
  KEY idx_participants_registration_status (registration_status),
  UNIQUE KEY uq_participants_email_cohort (email, cohort_id),
  CONSTRAINT fk_participants_cohort
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_participants_program
    FOREIGN KEY (program_id) REFERENCES programs(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  participant_id BIGINT UNSIGNED NOT NULL,
  cohort_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(150) NULL,
  stripe_checkout_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  checkout_url VARCHAR(2048) NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_transaction_id (transaction_id),
  UNIQUE KEY uq_payments_stripe_checkout_session_id (stripe_checkout_session_id),
  UNIQUE KEY uq_payments_stripe_payment_intent_id (stripe_payment_intent_id),
  KEY idx_payments_participant_id (participant_id),
  KEY idx_payments_cohort_id (cohort_id),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_participant
    FOREIGN KEY (participant_id) REFERENCES participants(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_payments_cohort
    FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_us (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fist_name VARCHAR(150) NULL,
  last_name VARCHAR(150) NULL,
  email VARCHAR(255) NULL,
  selected_topic VARCHAR(500) NULL,
  message TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admins (email, password)
VALUES (
  'admin@continuum.com',
  '$2b$10$GRElzVk7q6N.SBh6rkri/uL2F34mzAvCtVs7GgFrmsfluB9z0VBD2'
)
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  updated_at = CURRENT_TIMESTAMP;
