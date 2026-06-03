-- =====================================================================
-- PURGE des comptes corrompus (créés par seed.sql via INSERT auth.users)
-- Erreur dashboard : "Database error loading user" / impossible de Delete
-- =====================================================================
-- Exécuter dans : Supabase → SQL Editor → Run
-- =====================================================================

-- IDs fixes du seed (comptes cassés)
do $$
declare
  bad_ids uuid[] := array[
    '22222222-2222-2222-2222-000000000001'::uuid,
    '22222222-2222-2222-2222-000000000002'::uuid,
    '22222222-2222-2222-2222-000000000003'::uuid
  ];
  uid uuid;
begin
  foreach uid in array bad_ids loop
    -- 1) Bookings : DELETE avant de toucher au profil (sinon contrainte passenger_or_guest violée par cascade)
    delete from public.bookings where passenger_id = uid;
    -- 2) Bookings liées aux voyages du chauffeur
    delete from public.bookings where trip_id in (select id from public.trips where driver_id = uid);
    delete from public.ratings where passenger_id = uid or driver_id = uid;
    delete from public.driver_positions where driver_id = uid;
    delete from public.push_subscriptions where user_id = uid;
    delete from public.trips where driver_id = uid;
    delete from public.vehicles where driver_id = uid;
    delete from public.profiles where id = uid;

    -- Auth (tables internes Supabase)
    delete from auth.sessions where user_id = uid;
    delete from auth.refresh_tokens where user_id = uid;
    delete from auth.mfa_factors where user_id = uid;
    delete from auth.identities where user_id = uid;
    delete from auth.users where id = uid;

    raise notice 'Purged user %', uid;
  end loop;
end $$;

-- Aussi par email au cas où l'ID ne correspond pas
delete from auth.identities
 where user_id in (select id from auth.users where email in (
   'admin@easydunya.mr',
   'driver@easydunya.mr',
   'passenger@easydunya.mr'
 ));

delete from auth.sessions
 where user_id in (select id from auth.users where email in (
   'admin@easydunya.mr',
   'driver@easydunya.mr',
   'passenger@easydunya.mr'
 ));

delete from auth.refresh_tokens
 where user_id in (select id from auth.users where email in (
   'admin@easydunya.mr',
   'driver@easydunya.mr',
   'passenger@easydunya.mr'
 ));

delete from public.profiles
 where id in (select id from auth.users where email in (
   'admin@easydunya.mr',
   'driver@easydunya.mr',
   'passenger@easydunya.mr'
 ));

delete from auth.users
 where email in (
   'admin@easydunya.mr',
   'driver@easydunya.mr',
   'passenger@easydunya.mr'
 );

-- Vérification
select id, email, email_confirmed_at
  from auth.users
 order by created_at desc;
