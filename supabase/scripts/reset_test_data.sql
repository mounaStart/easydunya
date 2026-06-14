-- =====================================================================
-- RESET DONNÉES DE TEST
--   Supprime : passagers, chauffeurs, véhicules, prix villes, voyages,
--              réservations, paiements, notifications, positions, notes…
--   CONSERVE : le(s) compte(s) admin + la liste des villes (cities)
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) SÉCURITÉ : vérifier qu'on a bien (au moins) un admin AVANT de purger.
--    Si cette requête ne renvoie aucune ligne, NE PAS continuer
--    (sinon tous les comptes seraient supprimés).
-- ---------------------------------------------------------------------
select id, full_name, phone, role
from public.profiles
where role = 'admin';

-- ---------------------------------------------------------------------
-- 1) Purge des données transactionnelles (tables existantes seulement)
-- ---------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'public.payments',
    'public.driver_positions',
    'public.notifications',
    'public.ratings',
    'public.bookings',
    'public.trips',
    'public.vehicles',
    'public.city_prices',
    'public.push_subscriptions'
  ]
  loop
    if to_regclass(tbl) is not null then
      execute 'delete from ' || tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) Supprimer tous les comptes SAUF les admins.
--    La suppression dans auth.users supprime en cascade le profil associé
--    (profiles.id → auth.users ON DELETE CASCADE).
--    Garde-fou : on ne purge QUE s'il existe au moins un admin.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    delete from auth.users u
    where u.id not in (
      select p.id from public.profiles p where p.role = 'admin'
    );
  else
    raise notice 'Aucun admin trouvé : suppression des comptes ANNULÉE.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Réinitialiser le verrou éventuel des admins (au cas où)
-- ---------------------------------------------------------------------
update public.profiles set current_trip_id = null where current_trip_id is not null;

-- ---------------------------------------------------------------------
-- 4) VÉRIFICATION après nettoyage
-- ---------------------------------------------------------------------
select 'profiles'   as table_name, count(*) from public.profiles
union all select 'auth.users',  count(*) from auth.users
union all select 'cities',      count(*) from public.cities
union all select 'vehicles',    count(*) from public.vehicles
union all select 'trips',       count(*) from public.trips
union all select 'bookings',    count(*) from public.bookings
union all select 'city_prices', count(*) from public.city_prices
union all select 'payments',    count(*) from public.payments
union all select 'notifications', count(*) from public.notifications;
