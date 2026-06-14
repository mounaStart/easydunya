-- =====================================================================
-- DIAGNOSTIC : pourquoi le chauffeur ne voit pas la réservation ?
-- À exécuter dans Supabase → SQL Editor (en tant qu'admin/owner = bypass RLS)
-- =====================================================================

-- 1) Les colonnes attendues existent-elles sur bookings ?
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'bookings'
order by ordinal_position;

-- 2) Toutes les réservations récentes (peu importe le statut)
select b.id,
       b.trip_id,
       b.status,
       b.seats,
       b.is_waiting,
       b.passenger_id,
       b.guest_name,
       b.confirmation_code,
       b.created_at
from public.bookings b
order by b.created_at desc
limit 20;

-- 3) Réservations rattachées au voyage Nouadhibou -> Néma, avec le chauffeur
select b.id            as booking_id,
       b.status,
       b.seats,
       b.is_waiting,
       t.id            as trip_id,
       t.driver_id,
       p.full_name     as driver_name,
       cf.name_fr      as from_city,
       ct.name_fr      as to_city
from public.bookings b
join public.trips t   on t.id = b.trip_id
join public.profiles p on p.id = t.driver_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
order by b.created_at desc
limit 20;

-- 4) Vérifier l'ID du chauffeur connecté côté app vs driver_id du voyage
--    (remplace le téléphone si besoin)
-- select id, full_name, phone, role from public.profiles where role = 'driver';
