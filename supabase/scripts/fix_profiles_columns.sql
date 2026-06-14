-- =====================================================================
-- Réparer la table profiles (colonnes chauffeur manquantes)
-- Erreur : "Could not find the 'base_city_id' column of 'profiles'"
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

alter table public.profiles
  add column if not exists license_number text,
  add column if not exists base_city_id uuid references public.cities(id) on delete set null,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists current_trip_id uuid references public.trips(id) on delete set null;

-- Vue drivers_admin (si utilisée par l'admin)
create or replace view public.drivers_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.driver_status,
  p.rating_avg,
  p.rating_count,
  p.license_number,
  p.base_city_id,
  c.name_fr as base_city_name,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  (select count(*) from public.trips t where t.driver_id = p.id) as trips_total,
  (select count(*) from public.vehicles v where v.driver_id = p.id) as vehicles_total
from public.profiles p
join auth.users u on u.id = p.id
left join public.cities c on c.id = p.base_city_id
where p.role = 'driver';

grant select on public.drivers_admin to authenticated;

-- Vérification
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('license_number', 'base_city_id', 'must_change_password', 'current_trip_id')
order by column_name;
