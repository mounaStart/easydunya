-- =====================================================================
-- EASY DUNYA — Migration v2 (cahier des charges, points 3 à 11)
-- Additive et réexécutable. À lancer dans Supabase → SQL Editor.
--   • Table des prix par ville (city_prices)
--   • Champs auth chauffeur (must_change_password)
--   • Verrou GPS chauffeur engagé (current_trip_id)
--   • Lien voyage ↔ prix ville + distance
--   • Détails réservation (pickup GPS + quartier + liste d'attente)
--   • Notifications in-app
--   • Paiements
--   • Fonction de commission + maj des stats admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABLE DES PRIX PAR VILLE
-- ---------------------------------------------------------------------
create table if not exists public.city_prices (
  id             uuid primary key default uuid_generate_v4(),
  from_city_id   uuid not null references public.cities(id) on delete cascade,
  to_city_id     uuid not null references public.cities(id) on delete cascade,
  price_per_seat integer not null check (price_per_seat > 0),
  distance_km    numeric(7,2) not null default 0 check (distance_km >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (from_city_id, to_city_id),
  check (from_city_id <> to_city_id)
);

create index if not exists idx_city_prices_from on public.city_prices(from_city_id);
create index if not exists idx_city_prices_to on public.city_prices(to_city_id);

alter table public.city_prices enable row level security;

-- Lecture publique (chauffeurs/passagers voient les tarifs)
drop policy if exists "city_prices: public read" on public.city_prices;
create policy "city_prices: public read"
  on public.city_prices for select using (true);

-- Écriture réservée à l'admin
drop policy if exists "city_prices: admin write" on public.city_prices;
create policy "city_prices: admin write"
  on public.city_prices for all
  using (public.current_role_safe() = 'admin')
  with check (public.current_role_safe() = 'admin');

drop trigger if exists city_prices_touch on public.city_prices;
create trigger city_prices_touch before update on public.city_prices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 2) CHAMPS AUTH CHAUFFEUR + VERROU GPS
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists current_trip_id uuid references public.trips(id) on delete set null;

-- ---------------------------------------------------------------------
-- 3) LIEN VOYAGE ↔ PRIX VILLE + DISTANCE
-- ---------------------------------------------------------------------
alter table public.trips
  add column if not exists city_price_id uuid references public.city_prices(id) on delete set null,
  add column if not exists distance_km numeric(7,2);

-- ---------------------------------------------------------------------
-- 4) DÉTAILS RÉSERVATION (pickup GPS + quartier + liste d'attente)
-- ---------------------------------------------------------------------
alter table public.bookings
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists pickup_quartier text,
  add column if not exists is_waiting boolean not null default false;

-- ---------------------------------------------------------------------
-- 5) NOTIFICATIONS IN-APP
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  type       text,
  data       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
  on public.notifications for update
  using (user_id = auth.uid());

-- Insertion via fonction SECURITY DEFINER uniquement (voir notify_user / broadcast)

-- Envoi d'une notification à un utilisateur
create or replace function public.notify_user(
  p_user uuid, p_title text, p_body text default null,
  p_type text default null, p_data jsonb default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, data)
  values (p_user, p_title, p_body, p_type, p_data);
end;
$$;

grant execute on function public.notify_user(uuid,text,text,text,jsonb) to authenticated;

-- Broadcast aux chauffeurs ayant la même destination/date (redistribution annulation)
create or replace function public.broadcast_drivers_same_destination(
  p_to_city uuid, p_date date, p_title text, p_body text, p_data jsonb default null
) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.notifications (user_id, title, body, type, data)
  select distinct t.driver_id, p_title, p_body, 'inter_redistribution', p_data
  from public.trips t
  where t.to_city_id = p_to_city
    and t.status = 'scheduled'
    and (t.depart_at::date) = p_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.broadcast_drivers_same_destination(uuid,date,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6) PAIEMENTS
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id             uuid primary key default uuid_generate_v4(),
  booking_id     uuid references public.bookings(id) on delete cascade,
  trip_id        uuid references public.trips(id) on delete set null,
  passenger_id   uuid references public.profiles(id) on delete set null,
  driver_id      uuid references public.profiles(id) on delete set null,
  amount         integer not null default 0,
  commission     integer not null default 0,
  driver_earning integer not null default 0,
  method         text not null default 'cash',     -- cash | mobile_money
  status         text not null default 'pending',  -- pending | paid | failed
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_payments_driver on public.payments(driver_id);
create index if not exists idx_payments_trip on public.payments(trip_id);

alter table public.payments enable row level security;

drop policy if exists "payments: stakeholders read" on public.payments;
create policy "payments: stakeholders read"
  on public.payments for select
  using (
    passenger_id = auth.uid()
    or driver_id = auth.uid()
    or public.current_role_safe() = 'admin'
  );

-- ---------------------------------------------------------------------
-- 7) FONCTION DE COMMISSION (règle du cahier des charges)
--    distance >= 100 km  → 100 MRU par siège
--    distance <  100 km  → prix d'un siège par siège
-- ---------------------------------------------------------------------
create or replace function public.compute_commission(
  p_distance numeric, p_price integer, p_seats integer
) returns integer
language sql immutable
as $$
  select (case when coalesce(p_distance,0) >= 100 then 100 else p_price end) * greatest(coalesce(p_seats,1),1);
$$;

-- ---------------------------------------------------------------------
-- 8) MAJ DES STATS ADMIN (commission selon la nouvelle règle)
--    commission_revenue reste en numeric (comme 0003) : cast explicite
--    sinon PostgreSQL refuse CREATE OR REPLACE (42P16 numeric → bigint).
-- ---------------------------------------------------------------------
create or replace view public.admin_dashboard_stats as
select
  (select count(*) from public.profiles)                                         as users_count,
  (select count(*) from public.profiles where role = 'driver')                   as drivers_count,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'pending')  as drivers_pending,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'approved') as drivers_approved,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'suspended') as drivers_suspended,
  (select count(*) from public.profiles where role = 'passenger')                as passengers_count,
  (select count(*) from public.trips)                                            as trips_count,
  (select count(*) from public.trips where status = 'scheduled')                 as trips_scheduled,
  (select count(*) from public.trips where status = 'in_progress')               as trips_in_progress,
  (select count(*) from public.trips where status = 'completed')                 as trips_completed,
  (select count(*) from public.bookings)                                         as bookings_count,
  (select count(*) from public.bookings where status = 'pending')                as bookings_pending,
  (select count(*) from public.bookings where status = 'confirmed')              as bookings_confirmed,
  (select coalesce(sum(b.seats * t.price_per_seat), 0)
     from public.bookings b
     join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as gross_revenue,
  (select coalesce(sum(public.compute_commission(coalesce(t.distance_km, cp.distance_km), t.price_per_seat, b.seats)), 0)::numeric
     from public.bookings b
     join public.trips t on t.id = b.trip_id
     left join public.city_prices cp on cp.id = t.city_price_id
    where b.status in ('confirmed','completed'))                                 as commission_revenue;

grant select on public.admin_dashboard_stats to authenticated;

-- ---------------------------------------------------------------------
-- 9) SEED EXEMPLE — prix par ville (depuis Nouakchott), distances approx.
--    Réexécutable : on ne touche pas si la paire existe déjà.
-- ---------------------------------------------------------------------
insert into public.city_prices (from_city_id, to_city_id, price_per_seat, distance_km)
select nkc.id, dst.id, v.price, v.dist
from public.cities nkc
join (values
  ('Nouadhibou', 4000, 470.0),
  ('Rosso',      3500, 204.0),
  ('Boghé',      5000, 320.0),
  ('Kaédi',      8000, 435.0),
  ('Aleg',       4500, 255.0),
  ('Kiffa',     10000, 600.0),
  ('Aioun',     12000, 820.0),
  ('Néma',      18000, 1080.0),
  ('Atar',       9000, 435.0),
  ('Zouérat',   15000, 720.0),
  ('Sélibaby',  12000, 660.0),
  ('Tidjikja',  10000, 540.0),
  ('Kiffa',     10000, 600.0)
) as v(city, price, dist) on true
join public.cities dst on dst.name_fr = v.city
where nkc.name_fr = 'Nouakchott'
on conflict (from_city_id, to_city_id) do nothing;
