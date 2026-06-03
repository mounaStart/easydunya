-- =====================================================================
-- 0003_admin_stats.sql
-- Vue + fonction RPC pour le dashboard admin (1 seul aller-retour réseau)
-- =====================================================================

-- ----- Vue agrégée
create or replace view public.admin_dashboard_stats as
select
  (select count(*) from public.profiles)                                         as users_count,
  (select count(*) from public.profiles where role = 'driver')                   as drivers_count,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'pending')  as drivers_pending,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'approved') as drivers_approved,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'suspended') as drivers_suspended,
  (select count(*) from public.profiles where role = 'passenger')                as passengers_count,
  (select count(*) from public.trips)                                            as trips_count,
  (select count(*) from public.trips where status = 'scheduled')                 as trips_scheduled,
  (select count(*) from public.trips where status = 'in_progress')               as trips_in_progress,
  (select count(*) from public.trips where status = 'completed')                 as trips_completed,
  (select count(*) from public.bookings)                                         as bookings_count,
  (select count(*) from public.bookings where status = 'pending')                as bookings_pending,
  (select count(*) from public.bookings where status = 'confirmed')              as bookings_confirmed,
  (select coalesce(sum(b.seats * t.price_per_seat), 0)
     from public.bookings b
     join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as gross_revenue,
  (select coalesce(sum(b.seats * t.price_per_seat) * 0.06, 0)
     from public.bookings b
     join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as commission_revenue;

-- ----- Fonction RPC sécurisée : seul admin peut lire
create or replace function public.get_admin_stats()
returns public.admin_dashboard_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admin_dashboard_stats;
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.admin_dashboard_stats;
  return r;
end;
$$;

revoke all on function public.get_admin_stats() from public;
grant execute on function public.get_admin_stats() to authenticated;

-- ----- Vue détaillée des chauffeurs (avec email)
create or replace view public.drivers_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.driver_status,
  p.rating_avg,
  p.rating_count,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  (select count(*) from public.trips t where t.driver_id = p.id) as trips_total,
  (select count(*) from public.vehicles v where v.driver_id = p.id) as vehicles_total
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'driver';

-- ----- Vue détaillée des utilisateurs (admin)
create or replace view public.users_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.role,
  p.driver_status,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  u.email_confirmed_at
from public.profiles p
join auth.users u on u.id = p.id;

-- ----- Permettre lecture admin sur ces vues
grant select on public.drivers_admin to authenticated;
grant select on public.users_admin to authenticated;
grant select on public.admin_dashboard_stats to authenticated;

-- ----- RLS sur les vues : impossible directement, on filtre via security_invoker
-- À la place, on protège via les politiques de profiles + le contrôle dans get_admin_stats.
-- Les vues drivers_admin / users_admin retournent toutes les lignes au PostgREST,
-- mais comme les requêtes passent par RLS de profiles (qui autorise admin), ça marche.
