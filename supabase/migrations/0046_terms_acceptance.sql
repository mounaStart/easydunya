-- =====================================================================
-- 0046 — Acceptation des CGU par compte utilisateur
-- =====================================================================

alter table public.profiles
  add column if not exists terms_accepted_version text,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_accepted_version is
  'Version des CGU acceptée par l''utilisateur (ex. "1").';
comment on column public.profiles.terms_accepted_at is
  'Date/heure d''acceptation des CGU.';
