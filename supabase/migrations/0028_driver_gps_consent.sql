-- =====================================================================
-- 0028 — Consentement GPS chauffeur (obligatoire)
--   true  = GPS accepté, visible pour les passagers
--   false = GPS refusé, voyages masqués côté passager
--   null  = en attente de réponse
-- =====================================================================

alter table public.profiles
  add column if not exists gps_consent boolean;

comment on column public.profiles.gps_consent is
  'Chauffeur : true=GPS accepté, false=refusé, null=non répondu';

create or replace view public.trips_public as
select
  t.id,
  t.driver_id,
  d.full_name           as driver_name,
  d.rating_avg          as driver_rating,
  d.rating_count        as driver_rating_count,
  nullif(trim(concat_ws(' ', v.make, v.model)), '') as vehicle_label,
  v.plate               as vehicle_plate,
  v.seats               as vehicle_seats,
  t.from_city_id,
  cf.name_fr            as from_name_fr,
  cf.name_ar            as from_name_ar,
  cf.latitude           as from_lat,
  cf.longitude          as from_lng,
  t.to_city_id,
  ct.name_fr            as to_name_fr,
  ct.name_ar            as to_name_ar,
  ct.latitude           as to_lat,
  ct.longitude          as to_lng,
  t.depart_at,
  t.price_per_seat,
  t.seats_total,
  t.seats_available,
  t.notes,
  t.status,
  t.started_at,
  t.ended_at,
  t.created_at,
  v.make                as vehicle_make,
  d.photo_url           as driver_photo,
  coalesce(t.depart_lat, cf.latitude)  as depart_lat,
  coalesce(t.depart_lng, cf.longitude) as depart_lng,
  t.depart_quartier     as depart_quartier,
  coalesce(
    t.distance_km,
    cp.distance_km,
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    0
  )                     as distance_km
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
left join public.city_prices cp on cp.id = t.city_price_id
where d.gps_consent is true;
