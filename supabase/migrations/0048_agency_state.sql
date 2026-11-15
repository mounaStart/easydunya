-- =====================================================================
-- 0048 — État partagé des agences (petites agences en production)
-- Un document JSON unique, lisible et enregistrable par l'app.
-- Permet à l'admin Easy Dunya de créer une agence visible sur tous les appareils.
-- =====================================================================

create table if not exists public.agency_kv (
  id         text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.agency_kv enable row level security;

drop policy if exists "agency_kv: public read" on public.agency_kv;
create policy "agency_kv: public read"
  on public.agency_kv for select
  using (true);

drop policy if exists "agency_kv: public insert" on public.agency_kv;
create policy "agency_kv: public insert"
  on public.agency_kv for insert
  with check (true);

drop policy if exists "agency_kv: public update" on public.agency_kv;
create policy "agency_kv: public update"
  on public.agency_kv for update
  using (true);

comment on table public.agency_kv is
  'État JSON des petites agences (création admin Easy Dunya, départs, réservations).';
