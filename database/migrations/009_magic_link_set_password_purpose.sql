ALTER TABLE magic_link_tokens
  DROP CONSTRAINT IF EXISTS magic_link_tokens_purpose_check;

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_purpose_check
  CHECK (purpose IN ('login', 'file_download', 'dashboard_access', 'set_password'));
