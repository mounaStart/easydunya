-- =====================================================================
-- Purge PARTIELLE Easy Dunya
-- Supprime : chauffeurs, passagers, commissions, voyages disponibles
-- Conserve : compte(s) ADMIN + villes (cities) + prix villes (city_prices)
--
-- Projet : prfmqfnaqtmyfyxqjeli
-- Supabase → SQL Editor → Run
-- =====================================================================

-- Aperçu avant purge
select role, count(*) as nb from public.profiles group by role;
select status, count(*) as nb from public.trips group by status;
select count(*) as nb_payments from public.payments;

-- ---------------------------------------------------------------------
-- 1) Commissions / paiements
-- ---------------------------------------------------------------------
delete from public.payments;

-- ---------------------------------------------------------------------
-- 2) Données liées aux voyages & réservations
-- ---------------------------------------------------------------------
delete from public.notifications
where user_id in (
  select id from public.profiles where role in ('passenger', 'driver')
);

delete from public.ratings;
delete from public.bookings;
delete from public.driver_positions;

-- Voyages disponibles / programmés (et voyages liés aux chauffeurs supprimés)
delete from public.trips
where status in ('scheduled', 'in_progress');

-- Option : décommenter pour supprimer TOUS les voyages (y compris terminés)
-- delete from public.trips;

delete from public.vehicles
where driver_id in (
  select id from public.profiles where role = 'driver'
);

-- ---------------------------------------------------------------------
-- 3) Supprimer comptes chauffeur + passager (pas les admin)
-- ---------------------------------------------------------------------
delete from auth.users u
using public.profiles p
where p.id = u.id
  and p.role in ('passenger', 'driver');

-- ---------------------------------------------------------------------
-- 4) Nettoyage admin
-- ---------------------------------------------------------------------
update public.profiles
set current_trip_id = null
where current_trip_id is not null;

-- ---------------------------------------------------------------------
-- 5) Vérification
-- ---------------------------------------------------------------------
select 'profiles par rôle' as info, role, count(*)
from public.profiles group by role;

select 'trips restants' as info, status, count(*)
from public.trips group by status;

select 'bookings' as info, count(*) from public.bookings
union all select 'payments (commissions)', count(*) from public.payments
union all select 'vehicles', count(*) from public.vehicles;

select u.email, p.role, p.full_name
from auth.users u
join public.profiles p on p.id = u.id
order by p.role;
