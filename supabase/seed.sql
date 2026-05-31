-- =====================================================================
-- EASY DUNYA - Seed data
-- Villes de Mauritanie + comptes de démo
-- =====================================================================

-- ---- VILLES (coordonnées approximatives, OpenStreetMap)
insert into public.cities (id, name_fr, name_ar, region, latitude, longitude) values
  ('11111111-1111-1111-1111-000000000001','Nouakchott','نواكشوط','Nouakchott',18.0735,-15.9582),
  ('11111111-1111-1111-1111-000000000002','Nouadhibou','نواذيبو','Dakhlet Nouadhibou',20.9333,-17.0333),
  ('11111111-1111-1111-1111-000000000003','Rosso','روصو','Trarza',16.5138,-15.8055),
  ('11111111-1111-1111-1111-000000000004','Boghé','بوغي','Brakna',16.5836,-14.2700),
  ('11111111-1111-1111-1111-000000000005','Kaédi','كيهيدي','Gorgol',16.1500,-13.5000),
  ('11111111-1111-1111-1111-000000000006','Aleg','ألاك','Brakna',17.0533,-13.9070),
  ('11111111-1111-1111-1111-000000000007','Kiffa','كيفا','Assaba',16.6200,-11.4040),
  ('11111111-1111-1111-1111-000000000008','Aioun','العيون','Hodh El Gharbi',16.6661,-9.6147),
  ('11111111-1111-1111-1111-000000000009','Néma','النعمة','Hodh Ech Chargui',16.6200,-7.2500),
  ('11111111-1111-1111-1111-000000000010','Atar','أطار','Adrar',20.5169,-13.0499),
  ('11111111-1111-1111-1111-000000000011','Zouérat','الزويرات','Tiris Zemmour',22.7355,-12.4836),
  ('11111111-1111-1111-1111-000000000012','Sélibaby','سيليبابي','Guidimakha',15.1597,-12.1844),
  ('11111111-1111-1111-1111-000000000013','Tidjikja','تجكجة','Tagant',18.5500,-11.4333)
on conflict (id) do nothing;

-- =====================================================================
-- COMPTES DE DÉMO
-- =====================================================================
-- Mot de passe : password123  (hash bcrypt pré-calculé)
-- Les triggers `on_auth_user_created` créeront automatiquement les profils,
-- on les met à jour ensuite pour fixer le rôle et le nom.

-- ----- ADMIN
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, instance_id)
values (
  '22222222-2222-2222-2222-000000000001',
  'admin@easydunya.mr',
  crypt('password123', gen_salt('bf')),
  now(),
  jsonb_build_object('role','admin','full_name','Admin Easy Dunya','phone','+22230000001'),
  'authenticated','authenticated','00000000-0000-0000-0000-000000000000'
) on conflict (id) do nothing;

-- ----- CHAUFFEUR
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, instance_id)
values (
  '22222222-2222-2222-2222-000000000002',
  'driver@easydunya.mr',
  crypt('password123', gen_salt('bf')),
  now(),
  jsonb_build_object('role','driver','full_name','Mohamed Ould Sidi','phone','+22230000002'),
  'authenticated','authenticated','00000000-0000-0000-0000-000000000000'
) on conflict (id) do nothing;

-- ----- PASSAGER
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, aud, role, instance_id)
values (
  '22222222-2222-2222-2222-000000000003',
  'passenger@easydunya.mr',
  crypt('password123', gen_salt('bf')),
  now(),
  jsonb_build_object('role','passenger','full_name','Aminata Diallo','phone','+22230000003'),
  'authenticated','authenticated','00000000-0000-0000-0000-000000000000'
) on conflict (id) do nothing;

-- Forcer les rôles dans profiles (au cas où le trigger n'aurait pas pris)
update public.profiles set role = 'admin',     driver_status = null,        full_name = 'Admin Easy Dunya',     phone = '+22230000001' where id = '22222222-2222-2222-2222-000000000001';
update public.profiles set role = 'driver',    driver_status = 'approved',  full_name = 'Mohamed Ould Sidi',    phone = '+22230000002' where id = '22222222-2222-2222-2222-000000000002';
update public.profiles set role = 'passenger', full_name = 'Aminata Diallo', phone = '+22230000003'              where id = '22222222-2222-2222-2222-000000000003';

-- Sécurité : si les triggers n'ont pas créé les profils, on les insère
insert into public.profiles (id, role, full_name, phone, driver_status)
  values ('22222222-2222-2222-2222-000000000001','admin','Admin Easy Dunya','+22230000001',null)
  on conflict (id) do nothing;
insert into public.profiles (id, role, full_name, phone, driver_status)
  values ('22222222-2222-2222-2222-000000000002','driver','Mohamed Ould Sidi','+22230000002','approved')
  on conflict (id) do nothing;
insert into public.profiles (id, role, full_name, phone, driver_status)
  values ('22222222-2222-2222-2222-000000000003','passenger','Aminata Diallo','+22230000003',null)
  on conflict (id) do nothing;

-- ----- VÉHICULE pour le chauffeur démo
insert into public.vehicles (id, driver_id, make, model, plate, seats, features)
values (
  '33333333-3333-3333-3333-000000000001',
  '22222222-2222-2222-2222-000000000002',
  'Toyota','Hiace','3456 AA RIM',8,'Climatisé, bagages autorisés'
) on conflict (id) do nothing;

-- ----- VOYAGES DE DÉMO (dans les 7 prochains jours)
insert into public.trips (id, driver_id, vehicle_id, from_city_id, to_city_id, depart_at, price_per_seat, seats_total, seats_available, notes, status)
values
  ('44444444-4444-4444-4444-000000000001',
   '22222222-2222-2222-2222-000000000002',
   '33333333-3333-3333-3333-000000000001',
   '11111111-1111-1111-1111-000000000001', -- Nouakchott
   '11111111-1111-1111-1111-000000000004', -- Boghé
   now() + interval '6 hours', 5000, 8, 6,
   'Départ du garage Carrefour Madrid, climatisé', 'scheduled'),
  ('44444444-4444-4444-4444-000000000002',
   '22222222-2222-2222-2222-000000000002',
   '33333333-3333-3333-3333-000000000001',
   '11111111-1111-1111-1111-000000000001',
   '11111111-1111-1111-1111-000000000005', -- Kaédi
   now() + interval '1 day 8 hours', 7000, 8, 8,
   'Voyage rapide', 'scheduled'),
  ('44444444-4444-4444-4444-000000000003',
   '22222222-2222-2222-2222-000000000002',
   '33333333-3333-3333-3333-000000000001',
   '11111111-1111-1111-1111-000000000001',
   '11111111-1111-1111-1111-000000000003', -- Rosso
   now() + interval '2 days 10 hours', 3000, 8, 5,
   null, 'scheduled')
on conflict (id) do nothing;

-- ----- RÉSERVATION DE DÉMO (passager → premier voyage)
insert into public.bookings (id, trip_id, passenger_id, seats, confirmation_code, status)
values (
  '55555555-5555-5555-5555-000000000001',
  '44444444-4444-4444-4444-000000000001',
  '22222222-2222-2222-2222-000000000003',
  2, 'K3MX72', 'confirmed'
) on conflict (id) do nothing;
