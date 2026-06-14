-- =====================================================================
-- 0013 — Renseigner les distances manquantes (Haversine) puis recalculer
--        les commissions. Corrige le cas où distance_km = 0/NULL faisait
--        tomber un long trajet dans le forfait 100 MRU.
-- =====================================================================

-- Fonction utilitaire : distance en km entre deux villes (Haversine)
create or replace function public.cities_distance_km(p_from uuid, p_to uuid)
returns numeric
language sql stable
as $$
  select case
    when cf.id is null or ct.id is null then 0
    else round((6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(cf.latitude)) * cos(radians(ct.latitude))
        * cos(radians(ct.longitude) - radians(cf.longitude))
        + sin(radians(cf.latitude)) * sin(radians(ct.latitude))
      ))
    ))::numeric, 1)
  end
  from (select 1) x
  left join public.cities cf on cf.id = p_from
  left join public.cities ct on ct.id = p_to;
$$;

-- 1) Compléter les distances manquantes dans city_prices
update public.city_prices cp
set distance_km = public.cities_distance_km(cp.from_city_id, cp.to_city_id)
where coalesce(cp.distance_km, 0) = 0;

-- 2) Compléter les distances manquantes sur les voyages
update public.trips t
set distance_km = public.cities_distance_km(t.from_city_id, t.to_city_id)
where coalesce(t.distance_km, 0) = 0;

-- 3) Recalculer les paiements avec la distance désormais correcte
update public.payments p
set
  commission = public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat,
    b.seats
  ),
  driver_earning = p.amount - public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat,
    b.seats
  )
from public.bookings b
join public.trips t on t.id = b.trip_id
where p.booking_id = b.id;

-- 4) Vérification : distances + commission attendue par voyage récent
select
  cf.name_fr || ' → ' || ct.name_fr            as trajet,
  public.cities_distance_km(t.from_city_id, t.to_city_id) as distance_km,
  t.price_per_seat,
  public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat, 1)                        as commission_1_place
from public.trips t
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
order by t.created_at desc
limit 10;
