-- =====================================================================
-- EASY DUNYA - Schéma PostgreSQL initial
-- =====================================================================
-- Tables : profiles, cities, vehicles, trips, bookings, ratings,
--          driver_positions, push_subscriptions
-- Sécurité : Row Level Security activée sur toutes les tables sensibles
-- Vues : trips_public (jointures pré-calculées), city_trip_counts
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('passenger','driver','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type driver_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type trip_status as enum ('scheduled','in_progress','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('pending','confirmed','rejected','cancelled','completed');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- TABLE: cities
-- ---------------------------------------------------------------------
create table if not exists public.cities (
  id           uuid primary key default uuid_generate_v4(),
  name_fr      text not null,
  name_ar      text not null,
  region       text,
  latitude     double precision not null,
  longitude    double precision not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABLE: profiles
-- (étend auth.users — 1 row par utilisateur)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role not null default 'passenger',
  full_name       text,
  phone           text,
  preferred_lang  text not null default 'fr',
  driver_status   driver_status,
  rating_avg      numeric(3,2),
  rating_count    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);

-- ---------------------------------------------------------------------
-- TABLE: vehicles (appartiennent aux chauffeurs)
-- ---------------------------------------------------------------------
create table if not exists public.vehicles (
  id           uuid primary key default uuid_generate_v4(),
  driver_id    uuid not null references public.profiles(id) on delete cascade,
  make         text not null,
  model        text not null,
  plate        text not null,
  seats        integer not null check (seats between 1 and 60),
  features     text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_vehicles_driver on public.vehicles(driver_id);

-- ---------------------------------------------------------------------
-- TABLE: trips (voyages programmés)
-- ---------------------------------------------------------------------
create table if not exists public.trips (
  id                uuid primary key default uuid_generate_v4(),
  driver_id         uuid not null references public.profiles(id) on delete cascade,
  vehicle_id        uuid references public.vehicles(id) on delete set null,
  from_city_id      uuid not null references public.cities(id),
  to_city_id        uuid not null references public.cities(id),
  depart_at         timestamptz not null,
  price_per_seat    integer not null check (price_per_seat > 0),
  seats_total       integer not null check (seats_total > 0),
  seats_available   integer not null check (seats_available >= 0),
  notes             text,
  status            trip_status not null default 'scheduled',
  started_at        timestamptz,
  ended_at          timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_trips_depart on public.trips(depart_at);
create index if not exists idx_trips_from on public.trips(from_city_id);
create index if not exists idx_trips_to on public.trips(to_city_id);
create index if not exists idx_trips_status on public.trips(status);
create index if not exists idx_trips_driver on public.trips(driver_id);

-- ---------------------------------------------------------------------
-- TABLE: bookings (réservations — passager peut être invité)
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id                uuid primary key default uuid_generate_v4(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  passenger_id      uuid references public.profiles(id) on delete set null, -- null = invité
  guest_name        text,
  guest_phone       text,
  seats             integer not null default 1 check (seats > 0),
  confirmation_code text not null unique,
  status            booking_status not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint passenger_or_guest check (
    passenger_id is not null
    or (guest_name is not null and guest_phone is not null)
  )
);

create index if not exists idx_bookings_trip on public.bookings(trip_id);
create index if not exists idx_bookings_passenger on public.bookings(passenger_id);
create index if not exists idx_bookings_code on public.bookings(confirmation_code);
create index if not exists idx_bookings_status on public.bookings(status);

-- ---------------------------------------------------------------------
-- TABLE: ratings (notes données par passagers aux chauffeurs)
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  id            uuid primary key default uuid_generate_v4(),
  booking_id    uuid not null unique references public.bookings(id) on delete cascade,
  trip_id       uuid not null references public.trips(id) on delete cascade,
  driver_id     uuid not null references public.profiles(id) on delete cascade,
  passenger_id  uuid not null references public.profiles(id) on delete cascade,
  score         integer not null check (score between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_ratings_driver on public.ratings(driver_id);

-- ---------------------------------------------------------------------
-- TABLE: driver_positions (positions GPS en direct durant un voyage)
-- ---------------------------------------------------------------------
create table if not exists public.driver_positions (
  id           bigserial primary key,
  trip_id      uuid not null references public.trips(id) on delete cascade,
  driver_id    uuid not null references public.profiles(id) on delete cascade,
  latitude     double precision not null,
  longitude    double precision not null,
  recorded_at  timestamptz not null default now()
);

create index if not exists idx_positions_trip_time on public.driver_positions(trip_id, recorded_at desc);

-- ---------------------------------------------------------------------
-- TABLE: push_subscriptions (abonnements Web Push)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- 1) À la création d'un user auth, créer son profil par défaut (passenger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'passenger'),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) updated_at automatique
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- 3) Décrémenter seats_available lors d'une réservation confirmée
create or replace function public.adjust_trip_seats()
returns trigger language plpgsql as $$
declare
  delta integer := 0;
begin
  if TG_OP = 'INSERT' and new.status = 'confirmed' then
    delta := -new.seats;
  elsif TG_OP = 'UPDATE' then
    if old.status <> 'confirmed' and new.status = 'confirmed' then
      delta := -new.seats;
    elsif old.status = 'confirmed' and new.status <> 'confirmed' then
      delta := old.seats;
    end if;
  elsif TG_OP = 'DELETE' and old.status = 'confirmed' then
    delta := old.seats;
  end if;

  if delta <> 0 then
    update public.trips
       set seats_available = greatest(0, seats_available + delta)
     where id = coalesce(new.trip_id, old.trip_id);
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists bookings_adjust_seats on public.bookings;
create trigger bookings_adjust_seats
  after insert or update or delete on public.bookings
  for each row execute function public.adjust_trip_seats();

-- 4) Recalculer la note moyenne d'un chauffeur après chaque rating
create or replace function public.refresh_driver_rating()
returns trigger language plpgsql as $$
begin
  update public.profiles p
     set rating_avg   = sub.avg_score,
         rating_count = sub.cnt
    from (
      select driver_id, avg(score)::numeric(3,2) as avg_score, count(*) as cnt
        from public.ratings
       where driver_id = coalesce(new.driver_id, old.driver_id)
       group by driver_id
    ) sub
   where p.id = sub.driver_id;
  return coalesce(new, old);
end; $$;

drop trigger if exists ratings_refresh on public.ratings;
create trigger ratings_refresh
  after insert or update or delete on public.ratings
  for each row execute function public.refresh_driver_rating();

-- =====================================================================
-- VUES
-- =====================================================================

create or replace view public.trips_public as
select
  t.id,
  t.driver_id,
  d.full_name           as driver_name,
  d.rating_avg          as driver_rating,
  d.rating_count        as driver_rating_count,
  v.make || ' ' || v.model as vehicle_label,
  v.plate               as vehicle_plate,
  v.seats               as vehicle_seats,
  t.from_city_id,
  cf.name_fr            as from_name_fr,
  cf.name_ar            as from_name_ar,
  cf.latitude           as from_lat,
  cf.longitude          as from_lng,
  t.to_city_id,
  ct.name_fr            as to_name_fr,
  ct.name_ar            as to_name_ar,
  ct.latitude           as to_lat,
  ct.longitude          as to_lng,
  t.depart_at,
  t.price_per_seat,
  t.seats_total,
  t.seats_available,
  t.notes,
  t.status,
  t.started_at,
  t.ended_at,
  t.created_at
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id;

create or replace view public.city_trip_counts as
select c.id,
       c.name_fr,
       c.name_ar,
       c.latitude,
       c.longitude,
       count(t.id) filter (
         where t.status = 'scheduled'
           and t.depart_at between now() and now() + interval '7 days'
           and t.seats_available > 0
       ) as upcoming_trips
from public.cities c
left join public.trips t on t.from_city_id = c.id
group by c.id;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.vehicles            enable row level security;
alter table public.trips               enable row level security;
alter table public.bookings            enable row level security;
alter table public.ratings             enable row level security;
alter table public.driver_positions    enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.cities              enable row level security;

-- Helper : récupérer le rôle de l'utilisateur courant
create or replace function public.current_role_safe()
returns user_role
language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ============== CITIES : lecture publique
drop policy if exists "cities are readable by everyone" on public.cities;
create policy "cities are readable by everyone"
  on public.cities for select using (true);

-- ============== PROFILES
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.current_role_safe() = 'admin'
    or role = 'driver'  -- les noms / notes des chauffeurs sont publics
  );

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all"
  on public.profiles for update
  using (public.current_role_safe() = 'admin');

-- ============== VEHICLES
drop policy if exists "vehicles: driver crud own" on public.vehicles;
create policy "vehicles: driver crud own"
  on public.vehicles for all
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());

drop policy if exists "vehicles: public read" on public.vehicles;
create policy "vehicles: public read"
  on public.vehicles for select using (true);

-- ============== TRIPS
drop policy if exists "trips: public read" on public.trips;
create policy "trips: public read"
  on public.trips for select using (true);

drop policy if exists "trips: driver insert own" on public.trips;
create policy "trips: driver insert own"
  on public.trips for insert
  with check (
    driver_id = auth.uid()
    and public.current_role_safe() in ('driver','admin')
  );

drop policy if exists "trips: driver update own" on public.trips;
create policy "trips: driver update own"
  on public.trips for update
  using (driver_id = auth.uid() or public.current_role_safe() = 'admin');

drop policy if exists "trips: driver delete own" on public.trips;
create policy "trips: driver delete own"
  on public.trips for delete
  using (driver_id = auth.uid() or public.current_role_safe() = 'admin');

-- ============== BOOKINGS
-- Insertion : anonyme (guest) ou passager connecté
drop policy if exists "bookings: open insert" on public.bookings;
create policy "bookings: open insert"
  on public.bookings for insert
  with check (
    -- soit invité (passenger_id null)
    (passenger_id is null and guest_name is not null and guest_phone is not null)
    -- soit utilisateur connecté qui réserve pour lui-même
    or (passenger_id = auth.uid())
  );

-- Lecture : passager (le sien), chauffeur (sur ses voyages), admin (tout)
drop policy if exists "bookings: read own" on public.bookings;
create policy "bookings: read own"
  on public.bookings for select
  using (
    passenger_id = auth.uid()
    or exists (
      select 1 from public.trips t
       where t.id = bookings.trip_id and t.driver_id = auth.uid()
    )
    or public.current_role_safe() = 'admin'
  );

-- Mise à jour : passager (annule la sienne), chauffeur (sur ses voyages), admin
drop policy if exists "bookings: update by stakeholder" on public.bookings;
create policy "bookings: update by stakeholder"
  on public.bookings for update
  using (
    passenger_id = auth.uid()
    or exists (
      select 1 from public.trips t
       where t.id = bookings.trip_id and t.driver_id = auth.uid()
    )
    or public.current_role_safe() = 'admin'
  );

-- ============== RATINGS
drop policy if exists "ratings: passenger insert own" on public.ratings;
create policy "ratings: passenger insert own"
  on public.ratings for insert
  with check (passenger_id = auth.uid());

drop policy if exists "ratings: public read" on public.ratings;
create policy "ratings: public read"
  on public.ratings for select using (true);

-- ============== DRIVER POSITIONS
drop policy if exists "positions: driver insert own" on public.driver_positions;
create policy "positions: driver insert own"
  on public.driver_positions for insert
  with check (driver_id = auth.uid());

drop policy if exists "positions: stakeholders read" on public.driver_positions;
create policy "positions: stakeholders read"
  on public.driver_positions for select
  using (
    driver_id = auth.uid()
    or exists (
      select 1 from public.bookings b
       where b.trip_id = driver_positions.trip_id
         and b.passenger_id = auth.uid()
    )
    or public.current_role_safe() = 'admin'
  );

-- ============== PUSH SUBSCRIPTIONS
drop policy if exists "push: crud own" on public.push_subscriptions;
create policy "push: crud own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Activer Realtime sur les tables clés
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.driver_positions;
