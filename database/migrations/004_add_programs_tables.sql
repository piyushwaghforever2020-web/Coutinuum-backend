CREATE TABLE IF NOT EXISTS programs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
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

ALTER TABLE cohorts
ADD COLUMN has_multi_program TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

ALTER TABLE participants
ADD COLUMN program_id BIGINT UNSIGNED NULL AFTER cohort_id,
ADD CONSTRAINT fk_participants_program
  FOREIGN KEY (program_id) REFERENCES programs(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

-- Insert Hardcoded Programs
INSERT INTO programs (name, description) VALUES
('Program A', 'Description for Program A'),
('Program B', 'Description for Program B');
