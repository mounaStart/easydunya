-- =====================================================================
-- 0014 — Point de départ GPS du voyage (pour "voyage le plus proche")
--   Le chauffeur enregistre sa position de départ à la publication.
--   Repli automatique sur le centre-ville si non renseigné.
-- =====================================================================

alter table public.trips add column if not exists depart_lat      double precision;
alter table public.trips add column if not exists depart_lng      double precision;
alter table public.trips add column if not exists depart_quartier text;

-- Vue enrichie : on ajoute le point de départ (avec repli sur la ville)
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
  -- Point de départ effectif : GPS du chauffeur sinon centre-ville
  coalesce(t.depart_lat, cf.latitude)  as depart_lat,
  coalesce(t.depart_lng, cf.longitude) as depart_lng,
  t.depart_quartier     as depart_quartier
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id;
