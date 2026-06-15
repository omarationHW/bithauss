-- ========================================
-- Migration 007: broker / inmobiliaria registration fields
-- ========================================
-- Adds the fields the registration form asks for:
--   * profiles → rfc, address_line, secondary_email, secondary_phone
--   * company_profiles → email, secondary_email, secondary_phone
-- Also relaxes a few NOT NULL constraints so an Inmobiliaria can register
-- with only the company name (no legal rep name) and without an RFC,
-- per the v2 signup spec.

-- ── profiles: broker extras ───────────────────────────────────────
alter table profiles
  add column if not exists rfc              text,
  add column if not exists address_line     text,
  add column if not exists secondary_email  text,
  add column if not exists secondary_phone  text;

-- For Inmobiliaria the legal-rep name isn't asked; the company name lives
-- in profiles.first_name as a fallback for display, last_name stays empty.
-- Relax the NOT NULLs so a missing last_name doesn't break the insert.
alter table profiles alter column last_name drop not null;

-- ── company_profiles: contact fields + nullable rfc/trade_name ───
alter table company_profiles
  add column if not exists email            text,
  add column if not exists secondary_email  text,
  add column if not exists secondary_phone  text;

-- RFC and trade_name were NOT NULL but signup makes RFC optional and
-- doesn't ask for trade_name — fall back to legal_name on the read side.
alter table company_profiles alter column rfc        drop not null;
alter table company_profiles alter column trade_name drop not null;

-- Helpful lookup index on the new company email.
create index if not exists idx_company_profiles_email on company_profiles (email);
