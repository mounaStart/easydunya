-- =====================================================================
-- 0012 — Correction règle commission EasyDunya
--   distance > 100 km  → 6 % du prix par siège × nombre de sièges
--   distance ≤ 100 km  → 100 MRU forfait (par réservation)
-- =====================================================================

create or replace function public.compute_commission(
  p_distance numeric, p_price integer, p_seats integer
) returns integer
language sql immutable
as $$
  select case
    when coalesce(p_distance, 0) > 100 then
      greatest(round(p_price * 0.06)::integer, 0) * greatest(coalesce(p_seats, 1), 1)
    else
      100
  end;
$$;

-- Recalculer les paiements déjà enregistrés avec l'ancienne (mauvaise) règle
update public.payments p
set
  commission = public.compute_commission(
    coalesce(t.distance_km, cp.distance_km, 0),
    t.price_per_seat,
    b.seats
  ),
  driver_earning = p.amount - public.compute_commission(
    coalesce(t.distance_km, cp.distance_km, 0),
    t.price_per_seat,
    b.seats
  )
from public.bookings b
join public.trips t on t.id = b.trip_id
left join public.city_prices cp on cp.id = t.city_price_id
where p.booking_id = b.id;

-- Rafraîchir la vue stats admin (utilise compute_commission)
create or replace view public.admin_dashboard_stats as
select
  (select count(*) from public.profiles)                                         as users_count,
  (select count(*) from public.profiles where role = 'driver')                   as drivers_count,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'pending')  as drivers_pending,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'approved') as drivers_approved,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'suspended') as drivers_suspended,
  (select count(*) from public.profiles where role = 'passenger')                  as passengers_count,
  (select count(*) from public.trips)                                            as trips_count,
  (select count(*) from public.trips where status = 'scheduled')                 as trips_scheduled,
  (select count(*) from public.trips where status = 'in_progress')               as trips_in_progress,
  (select count(*) from public.trips where status = 'completed')                 as trips_completed,
  (select count(*) from public.bookings)                                         as bookings_count,
  (select count(*) from public.bookings where status = 'pending')                as bookings_pending,
  (select count(*) from public.bookings where status = 'confirmed')              as bookings_confirmed,
  (select coalesce(sum(t.price_per_seat * b.seats), 0)
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as gross_revenue,
  (select coalesce(sum(public.compute_commission(coalesce(t.distance_km, cp.distance_km), t.price_per_seat, b.seats)), 0)::numeric
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where b.status in ('confirmed','completed'))                                 as commission_revenue;
