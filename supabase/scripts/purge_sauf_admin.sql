-- =====================================================================
-- VIDER Easy Dunya — garder UNIQUEMENT le(s) compte(s) ADMIN
-- Projet : prfmqfnaqtmyfyxqjeli
--
-- SUPPRIME : passagers, chauffeurs, voyages, réservations, paiements,
--            notifications, véhicules, prix villes, push, tokens FCM…
-- CONSERVE : comptes role = admin + liste des villes (cities)
--            + config push (app_config)
--
-- Exécuter : Supabase → SQL Editor → Run (tout le fichier)
-- =====================================================================

-- 0) Admins qui seront CONSERVÉS (vérifiez avant de continuer)
select u.email, p.full_name, p.phone, p.role
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';

-- Si la liste ci-dessus est vide → ARRÊTEZ (ne pas exécuter la suite).

-- ---------------------------------------------------------------------
-- 1) Données métier (voyages, réservations, etc.)
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
    'public.push_subscriptions',
    'public.device_tokens'
  ]
  loop
    if to_regclass(tbl) is not null then
      execute 'delete from ' || tbl;
      raise notice 'Vidé : %', tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2) Supprimer tous les utilisateurs SAUF admin
--    (passagers + chauffeurs + comptes démo passenger/driver)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Aucun admin : purge des comptes annulée.';
  end if;

  delete from auth.users u
  where u.id not in (
    select p.id from public.profiles p where p.role = 'admin'
  );
end $$;

-- ---------------------------------------------------------------------
-- 3) Nettoyage profils admin (voyage en cours verrouillé)
-- ---------------------------------------------------------------------
update public.profiles
set
  current_trip_id = null,
  quartier = null,
  city_label = null,
  location_lat = null,
  location_lng = null,
  location_updated_at = null
where role = 'admin';

-- ---------------------------------------------------------------------
-- 4) Vérification après purge
-- ---------------------------------------------------------------------
select 'profiles'        as table_name, count(*) as nb from public.profiles
union all select 'auth.users',       count(*) from auth.users
union all select 'cities (conservé)', count(*) from public.cities
union all select 'trips',            count(*) from public.trips
union all select 'bookings',         count(*) from public.bookings
union all select 'vehicles',         count(*) from public.vehicles
union all select 'notifications',    count(*) from public.notifications
union all select 'city_prices',       count(*) from public.city_prices;

-- Comptes restants :
select u.email, p.role, p.full_name, p.phone
from auth.users u
join public.profiles p on p.id = u.id
order by p.role, u.email;
