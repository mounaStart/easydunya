-- =====================================================================
-- EASY DUNYA — Voyages de TEST
-- À exécuter dans Supabase → SQL Editor (compatible Cloud).
-- Le script :
--   1) choisit un chauffeur existant (de préférence approuvé) ;
--   2) lui crée un véhicule si besoin ;
--   3) insère plusieurs voyages programmés (dates futures) ;
--   4) (optionnel) crée une réservation confirmée pour un passager,
--      afin de tester la page « Réservation » (récap chauffeur + suivi).
-- Réexécutable sans danger.
-- =====================================================================

do $$
declare
  v_driver   uuid;
  v_vehicle  uuid;
  c_nkc uuid; c_ndb uuid; c_rosso uuid; c_boghe uuid; c_kaedi uuid;
  c_atar uuid; c_nema uuid; c_kiffa uuid;
begin
  -- 1) Chauffeur : approuvé en priorité, sinon n'importe quel chauffeur
  select id into v_driver
  from public.profiles
  where role = 'driver' and driver_status = 'approved'
  order by created_at limit 1;

  if v_driver is null then
    select id into v_driver
    from public.profiles where role = 'driver'
    order by created_at limit 1;
  end if;

  if v_driver is null then
    raise notice 'Aucun chauffeur trouvé. Crée un compte chauffeur (et approuve-le) avant de lancer ce script.';
    return;
  end if;

  -- 2) Véhicule
  select id into v_vehicle from public.vehicles where driver_id = v_driver limit 1;
  if v_vehicle is null then
    insert into public.vehicles (driver_id, make, model, plate, seats, features)
    values (v_driver, 'Toyota', 'Land Cruiser', 'TEST-2026', 8, 'Climatisation, bagages autorisés')
    returning id into v_vehicle;
  end if;

  -- Villes (UUID déterministes du seed)
  c_nkc   := '11111111-1111-1111-1111-000000000001'; -- Nouakchott
  c_ndb   := '11111111-1111-1111-1111-000000000002'; -- Nouadhibou
  c_rosso := '11111111-1111-1111-1111-000000000003'; -- Rosso
  c_boghe := '11111111-1111-1111-1111-000000000004'; -- Boghé
  c_kaedi := '11111111-1111-1111-1111-000000000005'; -- Kaédi
  c_kiffa := '11111111-1111-1111-1111-000000000007'; -- Kiffa
  c_nema  := '11111111-1111-1111-1111-000000000009'; -- Néma
  c_atar  := '11111111-1111-1111-1111-000000000010'; -- Atar

  -- 3) Voyages programmés (dates futures)
  insert into public.trips
    (driver_id, vehicle_id, from_city_id, to_city_id, depart_at, price_per_seat, seats_total, seats_available, notes, status)
  values
    (v_driver, v_vehicle, c_nkc, c_nema,  now() + interval '1 day 5 hours',  18000, 8, 8, 'Plus longue ligne', 'scheduled'),
    (v_driver, v_vehicle, c_nkc, c_atar,  now() + interval '1 day 8 hours',  9000,  11, 11, null, 'scheduled'),
    (v_driver, v_vehicle, c_nkc, c_boghe, now() + interval '6 hours',         5000,  8, 6, 'Départ garage Carrefour Madrid', 'scheduled'),
    (v_driver, v_vehicle, c_nkc, c_kaedi, now() + interval '2 days 7 hours',  8000,  8, 8, null, 'scheduled'),
    (v_driver, v_vehicle, c_nkc, c_rosso, now() + interval '10 hours',        3500,  8, 5, null, 'scheduled'),
    (v_driver, v_vehicle, c_nkc, c_kiffa, now() + interval '3 days',          10000, 8, 8, null, 'scheduled');

  raise notice 'OK : voyages de test créés pour le chauffeur %.', v_driver;
end $$;

-- =====================================================================
-- (OPTIONNEL) Pour tester la page « Réservation » côté passager :
-- 1) Connecte-toi dans l'app en tant que passager et réserve un voyage
--    (le statut sera « pending » → tu verras l'état de la demande).
-- 2) Pour simuler l'acceptation par le chauffeur, exécute :
--
--    update public.bookings
--    set status = 'confirmed'
--    where confirmation_code = 'XXXXXX';   -- remplace par ton code
--
--    → la page Réservation affichera alors le tableau récap du chauffeur
--      (nom, téléphone, véhicule, note) + le bouton Appeler + la carte de suivi.
-- =====================================================================
