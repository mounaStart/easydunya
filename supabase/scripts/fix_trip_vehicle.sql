-- =====================================================================
-- DIAGNOSTIC + RÉPARATION : marque/matricule vides côté passager
-- (le voyage n'a pas de véhicule lié, ou le chauffeur n'a pas de véhicule)
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 1) Le chauffeur a-t-il un véhicule enregistré ?
select v.id as vehicle_id, v.driver_id, p.full_name as driver_name,
       v.make, v.model, v.plate, v.seats
from public.vehicles v
join public.profiles p on p.id = v.driver_id
order by p.full_name;

-- 2) Les voyages et leur véhicule lié (NULL = pas de véhicule)
select t.id as trip_id, p.full_name as driver_name,
       t.vehicle_id, v.make, v.plate, t.status, t.depart_at
from public.trips t
join public.profiles p on p.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
order by t.created_at desc
limit 20;

-- 3) RÉPARATION : pour chaque voyage SANS véhicule, lier le 1er véhicule
--    du chauffeur (s'il en a un). Sûr et idempotent.
update public.trips t
set vehicle_id = (
  select v.id from public.vehicles v
  where v.driver_id = t.driver_id
  order by v.created_at asc
  limit 1
)
where t.vehicle_id is null
  and exists (
    select 1 from public.vehicles v where v.driver_id = t.driver_id
  );

-- 4) Vérification après réparation
select t.id as trip_id, p.full_name as driver_name,
       v.make, v.plate
from public.trips t
join public.profiles p on p.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
order by t.created_at desc
limit 20;
