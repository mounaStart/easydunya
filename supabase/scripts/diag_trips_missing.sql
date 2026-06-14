-- =====================================================================
-- DIAGNOSTIC : pourquoi un voyage n'apparaît pas dans "Voyages disponibles"
-- L'accueil affiche : status = 'scheduled' ET depart_at entre maintenant et +30j
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 1) TOUS les voyages bruts (table trips) avec villes + statut + départ
select
  t.id,
  cf.name_fr || ' → ' || ct.name_fr   as trajet,
  t.status,
  t.depart_at,
  (t.depart_at >= now())              as depart_dans_le_futur,
  (t.depart_at <= now() + interval '30 days') as dans_les_30j,
  t.seats_available,
  t.vehicle_id,
  t.driver_id
from public.trips t
left join public.cities cf on cf.id = t.from_city_id
left join public.cities ct on ct.id = t.to_city_id
order by t.created_at desc;

-- 2) Ce que la VUE trips_public renvoie réellement (ce que voit l'app)
--    Si un voyage est dans (1) mais absent de (2) => problème de jointure
--    (driver/véhicule/ville manquant dans la vue).
select
  tp.id,
  tp.from_name_fr || ' → ' || tp.to_name_fr as trajet,
  tp.status,
  tp.depart_at,
  tp.driver_name,
  tp.vehicle_label
from public.trips_public tp
order by tp.depart_at;

-- 3) Voyages présents dans trips mais ABSENTS de trips_public (jointure cassée)
select t.id,
       cf.name_fr || ' → ' || ct.name_fr as trajet,
       t.status, t.depart_at,
       t.driver_id, t.from_city_id, t.to_city_id
from public.trips t
left join public.cities cf on cf.id = t.from_city_id
left join public.cities ct on ct.id = t.to_city_id
where t.id not in (select id from public.trips_public);
