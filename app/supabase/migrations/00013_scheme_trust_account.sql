-- Migration 00013: Add trust account details to schemes
-- Required for WA-compliant levy notices (payment instructions)

ALTER TABLE public.schemes
  ADD COLUMN trust_bsb VARCHAR(7),
  ADD COLUMN trust_account_number VARCHAR(20),
  ADD COLUMN trust_account_name VARCHAR(255);
