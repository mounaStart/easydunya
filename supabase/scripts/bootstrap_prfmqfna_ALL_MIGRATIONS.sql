-- =====================================================================
-- Easy Dunya — TOUTES les migrations (0001 → 0025)
-- Projet cible : prfmqfnaqtmyfyxqjeli
--
-- ORDRE OBLIGATOIRE :
--   1) reset_public_before_migrate.sql  (une fois, si erreur full_name)
--   2) CE FICHIER (bootstrap complet)
--   3) seed.sql (villes) + setup_mounastart_admin.sql
--
-- Les noms de colonnes sont IDENTIQUES au projet Easy Dunya d'origine.
-- =====================================================================


-- ########## 0001_init.sql ##########

-- =====================================================================
-- EASY DUNYA - SchÃ©ma PostgreSQL initial
-- =====================================================================
-- Tables : profiles, cities, vehicles, trips, bookings, ratings,
--          driver_positions, push_subscriptions
-- SÃ©curitÃ© : Row Level Security activÃ©e sur toutes les tables sensibles
-- Vues : trips_public (jointures prÃ©-calculÃ©es), city_trip_counts
-- =====================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

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
  id           uuid primary key default gen_random_uuid(),
  name_fr      text not null,
  name_ar      text not null,
  region       text,
  latitude     double precision not null,
  longitude    double precision not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TABLE: profiles
-- (Ã©tend auth.users â€” 1 row par utilisateur)
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
  id           uuid primary key default gen_random_uuid(),
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
-- TABLE: trips (voyages programmÃ©s)
-- ---------------------------------------------------------------------
create table if not exists public.trips (
  id                uuid primary key default gen_random_uuid(),
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
-- TABLE: bookings (rÃ©servations â€” passager peut Ãªtre invitÃ©)
-- ---------------------------------------------------------------------
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  passenger_id      uuid references public.profiles(id) on delete set null, -- null = invitÃ©
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
-- TABLE: ratings (notes donnÃ©es par passagers aux chauffeurs)
-- ---------------------------------------------------------------------
create table if not exists public.ratings (
  id            uuid primary key default gen_random_uuid(),
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
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- 1) Ã€ la crÃ©ation d'un user auth, crÃ©er son profil par dÃ©faut (passenger)
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

-- 3) DÃ©crÃ©menter seats_available lors d'une rÃ©servation confirmÃ©e
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

-- 4) Recalculer la note moyenne d'un chauffeur aprÃ¨s chaque rating
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

-- Helper : rÃ©cupÃ©rer le rÃ´le de l'utilisateur courant
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
-- Insertion : anonyme (guest) ou passager connectÃ©
drop policy if exists "bookings: open insert" on public.bookings;
create policy "bookings: open insert"
  on public.bookings for insert
  with check (
    -- soit invitÃ© (passenger_id null)
    (passenger_id is null and guest_name is not null and guest_phone is not null)
    -- soit utilisateur connectÃ© qui rÃ©serve pour lui-mÃªme
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

-- Mise Ã  jour : passager (annule la sienne), chauffeur (sur ses voyages), admin
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

-- Activer Realtime sur les tables clÃ©s
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.driver_positions;

-- ########## 0002_phone_unique.sql ##########

-- =====================================================================
-- 0002_phone_unique.sql
-- Ajoute une contrainte d'unicitÃ© sur le numÃ©ro de tÃ©lÃ©phone (profiles.phone)
-- et expose un index. Les tÃ©lÃ©phones vides/null sont autorisÃ©s en doublon.
-- =====================================================================

-- 1) Nettoyer les Ã©ventuels doublons existants en gardant la ligne la plus ancienne
with d as (
  select id,
         row_number() over (partition by phone order by created_at) as rn
    from public.profiles
   where phone is not null and length(trim(phone)) > 0
)
update public.profiles p
   set phone = null
  from d
 where d.id = p.id and d.rn > 1;

-- 2) Index UNIQUE partiel (ignore les NULL)
create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and length(trim(phone)) > 0;

-- 3) Fonction sÃ©curisÃ©e pour vÃ©rifier l'unicitÃ© du tÃ©lÃ©phone Ã  l'inscription
--    (sans exposer tout le profil en lecture publique)
create or replace function public.is_phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where phone is not null
       and trim(phone) = trim(p_phone)
  );
$$;

revoke all on function public.is_phone_taken(text) from public;
grant execute on function public.is_phone_taken(text) to anon, authenticated;

-- ########## 0003_admin_stats.sql ##########

-- =====================================================================
-- 0003_admin_stats.sql
-- Vue + fonction RPC pour le dashboard admin (1 seul aller-retour rÃ©seau)
-- =====================================================================

-- ----- Vue agrÃ©gÃ©e
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
  (select coalesce(sum(b.seats * t.price_per_seat) * 0.06, 0)
     from public.bookings b
     join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as commission_revenue;

-- ----- Fonction RPC sÃ©curisÃ©e : seul admin peut lire
create or replace function public.get_admin_stats()
returns public.admin_dashboard_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.admin_dashboard_stats;
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.admin_dashboard_stats;
  return r;
end;
$$;

revoke all on function public.get_admin_stats() from public;
grant execute on function public.get_admin_stats() to authenticated;

-- ----- Vue dÃ©taillÃ©e des chauffeurs (avec email)
create or replace view public.drivers_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.driver_status,
  p.rating_avg,
  p.rating_count,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  (select count(*) from public.trips t where t.driver_id = p.id) as trips_total,
  (select count(*) from public.vehicles v where v.driver_id = p.id) as vehicles_total
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'driver';

-- ----- Vue dÃ©taillÃ©e des utilisateurs (admin)
create or replace view public.users_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.role,
  p.driver_status,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  u.email_confirmed_at
from public.profiles p
join auth.users u on u.id = p.id;

-- ----- Permettre lecture admin sur ces vues
grant select on public.drivers_admin to authenticated;
grant select on public.users_admin to authenticated;
grant select on public.admin_dashboard_stats to authenticated;

-- ----- RLS sur les vues : impossible directement, on filtre via security_invoker
-- Ã€ la place, on protÃ¨ge via les politiques de profiles + le contrÃ´le dans get_admin_stats.
-- Les vues drivers_admin / users_admin retournent toutes les lignes au PostgREST,
-- mais comme les requÃªtes passent par RLS de profiles (qui autorise admin), Ã§a marche.

-- ########## 0004_driver_fields.sql ##########

-- =====================================================================
-- 0004_driver_fields.sql
-- Champs supplÃ©mentaires pour les chauffeurs (licence, ville de base)
-- =====================================================================

alter table public.profiles
  add column if not exists license_number text,
  add column if not exists base_city_id uuid references public.cities(id) on delete set null;

-- Vue admin enrichie (recrÃ©ation avec nouvelles colonnes)
drop view if exists public.drivers_admin;
create view public.drivers_admin as
select
  p.id,
  p.full_name,
  p.phone,
  p.driver_status,
  p.rating_avg,
  p.rating_count,
  p.license_number,
  p.base_city_id,
  c.name_fr as base_city_name,
  p.created_at,
  u.email,
  u.last_sign_in_at,
  (select count(*) from public.trips t where t.driver_id = p.id) as trips_total,
  (select count(*) from public.vehicles v where v.driver_id = p.id) as vehicles_total
from public.profiles p
join auth.users u on u.id = p.id
left join public.cities c on c.id = p.base_city_id
where p.role = 'driver';

grant select on public.drivers_admin to authenticated;

-- ########## 0005_fix_admin_rls.sql ##########

-- =====================================================================
-- 0005_fix_admin_rls.sql
-- Corrige l'approbation chauffeur par l'admin (RLS bloquait les UPDATE)
-- =====================================================================

-- 1) Fonction rÃ´le : SECURITY DEFINER pour Ã©viter la rÃ©cursion RLS
create or replace function public.current_role_safe()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- 2) Politiques UPDATE profiles (admin peut modifier tous les profils)
drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all"
  on public.profiles
  for update
  using (public.current_role_safe() = 'admin')
  with check (public.current_role_safe() = 'admin');

-- 3) RPC dÃ©diÃ©e : mise Ã  jour du statut chauffeur (fiable, 1 appel)
create or replace function public.admin_set_driver_status(
  p_driver_id uuid,
  p_status public.driver_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_driver_id and role = 'driver'
  ) then
    raise exception 'not a driver profile' using errcode = 'P0002';
  end if;

  update public.profiles
     set driver_status = p_status,
         updated_at = now()
   where id = p_driver_id;
end;
$$;

revoke all on function public.admin_set_driver_status(uuid, public.driver_status) from public;
grant execute on function public.admin_set_driver_status(uuid, public.driver_status) to authenticated;

-- ########## 0006_booking_by_code.sql ##########

-- =====================================================================
-- EASY DUNYA â€” Lecture d'une rÃ©servation par son code de confirmation
-- La policy RLS "bookings: read own" ne permet de lire que ses propres
-- rÃ©servations (passager) ou celles de ses voyages (chauffeur).
-- Pour permettre le suivi d'une rÃ©servation Ã  partir de son CODE
-- (page RÃ©servation / VÃ©rifier), on expose une fonction SECURITY DEFINER
-- qui ne renvoie qu'UNE ligne correspondant exactement au code fourni.
-- Le code de confirmation joue alors le rÃ´le de "clÃ© d'accÃ¨s".
-- =====================================================================

create or replace function public.get_booking_by_code(p_code text)
returns table (
  id                uuid,
  trip_id           uuid,
  passenger_id      uuid,
  guest_name        text,
  guest_phone       text,
  seats             integer,
  confirmation_code text,
  status            public.booking_status,
  created_at        timestamptz,
  updated_at        timestamptz
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.trip_id, b.passenger_id, b.guest_name, b.guest_phone,
         b.seats, b.confirmation_code, b.status, b.created_at, b.updated_at
  from public.bookings b
  where b.confirmation_code = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.get_booking_by_code(text) from public;
grant execute on function public.get_booking_by_code(text) to anon, authenticated;

-- ########## 0007_ensure_profiles.sql ##########

-- =====================================================================
-- EASY DUNYA â€” Garantir un profil pour chaque utilisateur
-- ProblÃ¨me : la table profiles n'avait AUCUNE policy d'insertion. Les
-- profils n'Ã©taient crÃ©Ã©s que par le trigger handle_new_user. Si ce
-- trigger n'a pas tournÃ© (compte crÃ©Ã© avant, ou erreur), l'utilisateur
-- n'a pas de ligne dans profiles â†’ toute rÃ©servation Ã©choue
-- (bookings_passenger_id_fkey).
--
-- Ce script :
--   1) ajoute une policy permettant Ã  un user de crÃ©er SON profil ;
--   2) (re)crÃ©e un trigger robuste sur auth.users ;
--   3) rÃ©tro-crÃ©e les profils manquants pour les comptes existants.
-- RÃ©exÃ©cutable sans danger.
-- =====================================================================

-- 1) Policy d'insertion (un utilisateur crÃ©e uniquement son propre profil)
drop policy if exists "profiles: insert self" on public.profiles;
create policy "profiles: insert self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2) Trigger robuste : Ã  la crÃ©ation d'un compte auth, crÃ©er le profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'passenger');
  exception when others then
    v_role := 'passenger';
  end;

  insert into public.profiles (id, role, full_name, phone, driver_status)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    case when v_role = 'driver' then 'pending'::public.driver_status else null end
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Backfill des profils manquants pour les comptes dÃ©jÃ  existants
insert into public.profiles (id, role, full_name, phone, driver_status)
select
  u.id,
  case
    when u.raw_user_meta_data->>'role' in ('passenger','driver','admin')
      then (u.raw_user_meta_data->>'role')::public.user_role
    else 'passenger'::public.user_role
  end,
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'phone',
  case when u.raw_user_meta_data->>'role' = 'driver'
       then 'pending'::public.driver_status else null end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ########## 0008_easydunya_v2.sql ##########

-- =====================================================================
-- EASY DUNYA â€” Migration v2 (cahier des charges, points 3 Ã  11)
-- Additive et rÃ©exÃ©cutable. Ã€ lancer dans Supabase â†’ SQL Editor.
--   â€¢ Table des prix par ville (city_prices)
--   â€¢ Champs auth chauffeur (must_change_password)
--   â€¢ Verrou GPS chauffeur engagÃ© (current_trip_id)
--   â€¢ Lien voyage â†” prix ville + distance
--   â€¢ DÃ©tails rÃ©servation (pickup GPS + quartier + liste d'attente)
--   â€¢ Notifications in-app
--   â€¢ Paiements
--   â€¢ Fonction de commission + maj des stats admin
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABLE DES PRIX PAR VILLE
-- ---------------------------------------------------------------------
create table if not exists public.city_prices (
  id             uuid primary key default gen_random_uuid(),
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

-- Ã‰criture rÃ©servÃ©e Ã  l'admin
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
-- 3) LIEN VOYAGE â†” PRIX VILLE + DISTANCE
-- ---------------------------------------------------------------------
alter table public.trips
  add column if not exists city_price_id uuid references public.city_prices(id) on delete set null,
  add column if not exists distance_km numeric(7,2);

-- ---------------------------------------------------------------------
-- 4) DÃ‰TAILS RÃ‰SERVATION (pickup GPS + quartier + liste d'attente)
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
  id         uuid primary key default gen_random_uuid(),
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

-- Envoi d'une notification Ã  un utilisateur
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

-- Broadcast aux chauffeurs ayant la mÃªme destination/date (redistribution annulation)
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
  id             uuid primary key default gen_random_uuid(),
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
-- 7) FONCTION DE COMMISSION (rÃ¨gle du cahier des charges)
--    distance >= 100 km  â†’ 100 MRU par siÃ¨ge
--    distance <  100 km  â†’ prix d'un siÃ¨ge par siÃ¨ge
-- ---------------------------------------------------------------------
create or replace function public.compute_commission(
  p_distance numeric, p_price integer, p_seats integer
) returns integer
language sql immutable
as $$
  select (case when coalesce(p_distance,0) >= 100 then 100 else p_price end) * greatest(coalesce(p_seats,1),1);
$$;

-- ---------------------------------------------------------------------
-- 8) MAJ DES STATS ADMIN (commission selon la nouvelle rÃ¨gle)
--    commission_revenue reste en numeric (comme 0003) : cast explicite
--    sinon PostgreSQL refuse CREATE OR REPLACE (42P16 numeric â†’ bigint).
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
-- 9) SEED EXEMPLE â€” prix par ville (depuis Nouakchott), distances approx.
--    RÃ©exÃ©cutable : on ne touche pas si la paire existe dÃ©jÃ .
-- ---------------------------------------------------------------------
insert into public.city_prices (from_city_id, to_city_id, price_per_seat, distance_km)
select nkc.id, dst.id, v.price, v.dist
from public.cities nkc
join (values
  ('Nouadhibou', 4000, 470.0),
  ('Rosso',      3500, 204.0),
  ('BoghÃ©',      5000, 320.0),
  ('KaÃ©di',      8000, 435.0),
  ('Aleg',       4500, 255.0),
  ('Kiffa',     10000, 600.0),
  ('Aioun',     12000, 820.0),
  ('NÃ©ma',      18000, 1080.0),
  ('Atar',       9000, 435.0),
  ('ZouÃ©rat',   15000, 720.0),
  ('SÃ©libaby',  12000, 660.0),
  ('Tidjikja',  10000, 540.0),
  ('Kiffa',     10000, 600.0)
) as v(city, price, dist) on true
join public.cities dst on dst.name_fr = v.city
where nkc.name_fr = 'Nouakchott'
on conflict (from_city_id, to_city_id) do nothing;

-- ########## 0009_driver_lock_notifications.sql ##########

-- =====================================================================
-- 0009 â€” Verrou chauffeur, GPS, annulation + broadcast, paiements
-- =====================================================================

-- DÃ©marrer un voyage (verrouille le chauffeur)
create or replace function public.driver_start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_locked uuid;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;
  if v_trip.status <> 'scheduled' then raise exception 'trip not scheduled'; end if;

  select current_trip_id into v_locked from public.profiles where id = v_driver;
  if v_locked is not null then
    if exists (select 1 from public.trips where id = v_locked and status = 'in_progress') then
      raise exception 'driver already engaged on another trip';
    end if;
    update public.profiles set current_trip_id = null where id = v_driver;
  end if;

  update public.trips
  set status = 'in_progress', started_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = p_trip_id where id = v_driver;
end;
$$;
grant execute on function public.driver_start_trip(uuid) to authenticated;

-- Terminer un voyage (dÃ©verrouille + enregistre les paiements)
create or replace function public.driver_end_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  b record;
  v_gross integer;
  v_comm integer;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;

  update public.trips
  set status = 'completed', ended_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = null where id = v_driver;

  for b in
    select bk.*, coalesce(t.distance_km, cp.distance_km, 0) as dist
    from public.bookings bk
    join public.trips t on t.id = bk.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where bk.trip_id = p_trip_id and bk.status = 'confirmed'
  loop
    v_gross := b.seats * v_trip.price_per_seat;
    v_comm := public.compute_commission(b.dist, v_trip.price_per_seat, b.seats);
    if not exists (select 1 from public.payments where booking_id = b.id) then
      insert into public.payments (
        booking_id, trip_id, passenger_id, driver_id,
        amount, commission, driver_earning, method, status, paid_at
      ) values (
        b.id, p_trip_id, b.passenger_id, v_driver,
        v_gross, v_comm, v_gross - v_comm, 'cash', 'paid', now()
      );
    end if;
    update public.bookings set status = 'completed' where id = b.id;
  end loop;
end;
$$;
grant execute on function public.driver_end_trip(uuid) to authenticated;

-- Mise Ã  jour GPS + dÃ©blocage auto Ã  500 m de la destination
create or replace function public.driver_update_gps(
  p_trip_id uuid, p_lat double precision, p_lng double precision
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_dest record;
  v_dist_km numeric := null;
  v_unlocked boolean := false;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;

  insert into public.driver_positions (trip_id, driver_id, latitude, longitude)
  values (p_trip_id, v_driver, p_lat, p_lng);

  select t.*, c.latitude as dest_lat, c.longitude as dest_lng
  into v_dest
  from public.trips t
  join public.cities c on c.id = t.to_city_id
  where t.id = p_trip_id and t.driver_id = v_driver and t.status = 'in_progress';

  if found then
    v_dist_km := 6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(v_dest.dest_lat))
        * cos(radians(v_dest.dest_lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(v_dest.dest_lat))
      ))
    );
    if v_dist_km <= 0.5 then
      update public.profiles set current_trip_id = null where id = v_driver;
      v_unlocked := true;
    end if;
  end if;

  return jsonb_build_object('unlocked', v_unlocked, 'distance_km', round(coalesce(v_dist_km, 0)::numeric, 2));
end;
$$;
grant execute on function public.driver_update_gps(uuid, double precision, double precision) to authenticated;

-- Annulation voyage + broadcast aux autres chauffeurs (mÃªme destination/date)
create or replace function public.cancel_trip_with_broadcast(p_trip_id uuid, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_trip public.trips%rowtype;
  v_count integer := 0;
  v_body text;
  v_role public.user_role;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then raise exception 'trip not found'; end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' and v_trip.driver_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.trips set status = 'cancelled' where id = p_trip_id;
  update public.profiles set current_trip_id = null
  where id = v_trip.driver_id and current_trip_id = p_trip_id;

  update public.bookings set status = 'cancelled'
  where trip_id = p_trip_id and status in ('pending', 'confirmed');

  v_body := coalesce(p_reason, 'Un voyage vers votre destination a Ã©tÃ© annulÃ©. Des passagers peuvent Ãªtre disponibles.');
  v_count := public.broadcast_drivers_same_destination(
    v_trip.to_city_id,
    (v_trip.depart_at::date),
    'Voyage annulÃ© â€” passagers disponibles',
    v_body,
    jsonb_build_object('cancelled_trip_id', p_trip_id, 'to_city_id', v_trip.to_city_id)
  );
  return v_count;
end;
$$;
grant execute on function public.cancel_trip_with_broadcast(uuid, text) to authenticated;

-- Chauffeur verrouillÃ© ?
create or replace function public.is_driver_locked(p_driver_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.trips t on t.id = p.current_trip_id
    where p.id = p_driver_id and t.status = 'in_progress'
  );
$$;
grant execute on function public.is_driver_locked(uuid) to authenticated;

-- ########## 0010_vehicle_model_optional.sql ##########

-- =====================================================================
-- 0010 â€” Le modÃ¨le de vÃ©hicule devient optionnel
-- (Ã  la crÃ©ation d'un chauffeur, l'admin saisit marque + plaque + places)
-- =====================================================================

alter table public.vehicles
  alter column model drop not null;

-- L'admin peut crÃ©er/gÃ©rer les vÃ©hicules de n'importe quel chauffeur
-- (crÃ©ation de compte chauffeur + vÃ©hicule en une seule Ã©tape).
drop policy if exists "vehicles: admin crud" on public.vehicles;
create policy "vehicles: admin crud"
  on public.vehicles for all
  using (public.current_role_safe() = 'admin')
  with check (public.current_role_safe() = 'admin');

-- ########## 0011_driver_info_trip_notifs.sql ##########

-- =====================================================================
-- 0011 â€” Photo chauffeur, vue enrichie + notifications dÃ©marrage/fin voyage
-- =====================================================================

-- 1) Photo de profil (chauffeur) â€” optionnelle
alter table public.profiles add column if not exists photo_url text;

-- 2) Vue trips_public enrichie :
--    - vehicle_label robuste (modÃ¨le dÃ©sormais optionnel)
--    - vehicle_make (marque seule) + driver_photo (photo chauffeur)
create or replace view public.trips_public as
select
  t.id,
  t.driver_id,
  d.full_name           as driver_name,
  d.rating_avg          as driver_rating,
  d.rating_count        as driver_rating_count,
  nullif(trim(concat_ws(' ', v.make, v.model)), '') as vehicle_label,
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
  t.created_at,
  -- nouvelles colonnes (ajoutÃ©es Ã  la fin)
  v.make                as vehicle_make,
  d.photo_url           as driver_photo
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id;

-- 3) driver_start_trip : notifie les passagers confirmÃ©s du dÃ©marrage
create or replace function public.driver_start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_locked uuid;
  b record;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;
  if v_trip.status <> 'scheduled' then raise exception 'trip not scheduled'; end if;

  select current_trip_id into v_locked from public.profiles where id = v_driver;
  if v_locked is not null then
    if exists (select 1 from public.trips where id = v_locked and status = 'in_progress') then
      raise exception 'driver already engaged on another trip';
    end if;
    update public.profiles set current_trip_id = null where id = v_driver;
  end if;

  update public.trips
  set status = 'in_progress', started_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = p_trip_id where id = v_driver;

  -- Notifier chaque passager confirmÃ©
  for b in
    select id, passenger_id, confirmation_code
    from public.bookings
    where trip_id = p_trip_id and status = 'confirmed' and passenger_id is not null
  loop
    perform public.notify_user(
      b.passenger_id,
      'Le chauffeur a dÃ©marrÃ© le voyage ðŸš—',
      'Votre trajet est en cours. Code : ' || b.confirmation_code,
      'trip_started',
      jsonb_build_object('trip_id', p_trip_id, 'booking_id', b.id)
    );
  end loop;
end;
$$;
grant execute on function public.driver_start_trip(uuid) to authenticated;

-- 4) driver_end_trip : notifie les passagers Ã  la fin du voyage
create or replace function public.driver_end_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  b record;
  v_gross integer;
  v_comm integer;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;

  update public.trips
  set status = 'completed', ended_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = null where id = v_driver;

  for b in
    select bk.*, coalesce(t.distance_km, cp.distance_km, 0) as dist
    from public.bookings bk
    join public.trips t on t.id = bk.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where bk.trip_id = p_trip_id and bk.status = 'confirmed'
  loop
    v_gross := b.seats * v_trip.price_per_seat;
    v_comm := public.compute_commission(b.dist, v_trip.price_per_seat, b.seats);
    if not exists (select 1 from public.payments where booking_id = b.id) then
      insert into public.payments (
        booking_id, trip_id, passenger_id, driver_id,
        amount, commission, driver_earning, method, status, paid_at
      ) values (
        b.id, p_trip_id, b.passenger_id, v_driver,
        v_gross, v_comm, v_gross - v_comm, 'cash', 'paid', now()
      );
    end if;
    update public.bookings set status = 'completed' where id = b.id;

    if b.passenger_id is not null then
      perform public.notify_user(
        b.passenger_id,
        'Voyage terminÃ© âœ“',
        'Merci d''avoir voyagÃ© avec Easy Dunya. Code : ' || b.confirmation_code,
        'trip_completed',
        jsonb_build_object('trip_id', p_trip_id, 'booking_id', b.id)
      );
    end if;
  end loop;
end;
$$;
grant execute on function public.driver_end_trip(uuid) to authenticated;

-- ########## 0012_fix_commission.sql ##########

-- =====================================================================
-- 0012 â€” Correction rÃ¨gle commission EasyDunya
--   distance > 100 km  â†’ 6 % du prix par siÃ¨ge Ã— nombre de siÃ¨ges
--   distance â‰¤ 100 km  â†’ 100 MRU forfait (par rÃ©servation)
-- =====================================================================

create or replace function public.compute_commission(
  p_distance numeric, p_price integer, p_seats integer
) returns integer
language sql immutable
as $$
  select case
    when coalesce(p_distance, 0) > 100 then
      greatest(round(p_price * 0.06)::integer, 0) * greatest(coalesce(p_seats, 1), 1)
    else
      100
  end;
$$;

-- Recalculer les paiements dÃ©jÃ  enregistrÃ©s avec l'ancienne (mauvaise) rÃ¨gle
update public.payments p
set
  commission = public.compute_commission(
    coalesce(t.distance_km, cp.distance_km, 0),
    t.price_per_seat,
    b.seats
  ),
  driver_earning = p.amount - public.compute_commission(
    coalesce(t.distance_km, cp.distance_km, 0),
    t.price_per_seat,
    b.seats
  )
from public.bookings b
join public.trips t on t.id = b.trip_id
left join public.city_prices cp on cp.id = t.city_price_id
where p.booking_id = b.id;

-- RafraÃ®chir la vue stats admin (utilise compute_commission)
create or replace view public.admin_dashboard_stats as
select
  (select count(*) from public.profiles)                                         as users_count,
  (select count(*) from public.profiles where role = 'driver')                   as drivers_count,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'pending')  as drivers_pending,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'approved') as drivers_approved,
  (select count(*) from public.profiles where role = 'driver' and driver_status = 'suspended') as drivers_suspended,
  (select count(*) from public.profiles where role = 'passenger')                  as passengers_count,
  (select count(*) from public.trips)                                            as trips_count,
  (select count(*) from public.trips where status = 'scheduled')                 as trips_scheduled,
  (select count(*) from public.trips where status = 'in_progress')               as trips_in_progress,
  (select count(*) from public.trips where status = 'completed')                 as trips_completed,
  (select count(*) from public.bookings)                                         as bookings_count,
  (select count(*) from public.bookings where status = 'pending')                as bookings_pending,
  (select count(*) from public.bookings where status = 'confirmed')              as bookings_confirmed,
  (select coalesce(sum(t.price_per_seat * b.seats), 0)
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    where b.status in ('confirmed','completed'))                                 as gross_revenue,
  (select coalesce(sum(public.compute_commission(coalesce(t.distance_km, cp.distance_km), t.price_per_seat, b.seats)), 0)::numeric
    from public.bookings b
    join public.trips t on t.id = b.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where b.status in ('confirmed','completed'))                                 as commission_revenue;

-- ########## 0013_fix_distance_commission.sql ##########

-- =====================================================================
-- 0013 â€” Renseigner les distances manquantes (Haversine) puis recalculer
--        les commissions. Corrige le cas oÃ¹ distance_km = 0/NULL faisait
--        tomber un long trajet dans le forfait 100 MRU.
-- =====================================================================

-- Fonction utilitaire : distance en km entre deux villes (Haversine)
create or replace function public.cities_distance_km(p_from uuid, p_to uuid)
returns numeric
language sql stable
as $$
  select case
    when cf.id is null or ct.id is null then 0
    else round((6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(cf.latitude)) * cos(radians(ct.latitude))
        * cos(radians(ct.longitude) - radians(cf.longitude))
        + sin(radians(cf.latitude)) * sin(radians(ct.latitude))
      ))
    ))::numeric, 1)
  end
  from (select 1) x
  left join public.cities cf on cf.id = p_from
  left join public.cities ct on ct.id = p_to;
$$;

-- 1) ComplÃ©ter les distances manquantes dans city_prices
update public.city_prices cp
set distance_km = public.cities_distance_km(cp.from_city_id, cp.to_city_id)
where coalesce(cp.distance_km, 0) = 0;

-- 2) ComplÃ©ter les distances manquantes sur les voyages
update public.trips t
set distance_km = public.cities_distance_km(t.from_city_id, t.to_city_id)
where coalesce(t.distance_km, 0) = 0;

-- 3) Recalculer les paiements avec la distance dÃ©sormais correcte
update public.payments p
set
  commission = public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat,
    b.seats
  ),
  driver_earning = p.amount - public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat,
    b.seats
  )
from public.bookings b
join public.trips t on t.id = b.trip_id
where p.booking_id = b.id;

-- 4) VÃ©rification : distances + commission attendue par voyage rÃ©cent
select
  cf.name_fr || ' â†’ ' || ct.name_fr            as trajet,
  public.cities_distance_km(t.from_city_id, t.to_city_id) as distance_km,
  t.price_per_seat,
  public.compute_commission(
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    t.price_per_seat, 1)                        as commission_1_place
from public.trips t
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
order by t.created_at desc
limit 10;

-- ########## 0014_trip_departure_point.sql ##########

-- =====================================================================
-- 0014 â€” Point de dÃ©part GPS du voyage (pour "voyage le plus proche")
--   Le chauffeur enregistre sa position de dÃ©part Ã  la publication.
--   Repli automatique sur le centre-ville si non renseignÃ©.
-- =====================================================================

alter table public.trips add column if not exists depart_lat      double precision;
alter table public.trips add column if not exists depart_lng      double precision;
alter table public.trips add column if not exists depart_quartier text;

-- Vue enrichie : on ajoute le point de dÃ©part (avec repli sur la ville)
create or replace view public.trips_public as
select
  t.id,
  t.driver_id,
  d.full_name           as driver_name,
  d.rating_avg          as driver_rating,
  d.rating_count        as driver_rating_count,
  nullif(trim(concat_ws(' ', v.make, v.model)), '') as vehicle_label,
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
  t.created_at,
  v.make                as vehicle_make,
  d.photo_url           as driver_photo,
  -- Point de dÃ©part effectif : GPS du chauffeur sinon centre-ville
  coalesce(t.depart_lat, cf.latitude)  as depart_lat,
  coalesce(t.depart_lng, cf.longitude) as depart_lng,
  t.depart_quartier     as depart_quartier
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id;

-- ########## 0015_web_push.sql ##########

-- =====================================================================
-- WEB PUSH : abonnements navigateur + envoi automatique Ã  chaque
-- notification insÃ©rÃ©e. Les notifications apparaissent alors dans la
-- barre du tÃ©lÃ©phone (avec son/vibration) MÃŠME application fermÃ©e.
--
-- PrÃ©-requis (voir supabase/functions/send-push) :
--   1. DÃ©ployer l'Edge Function `send-push`
--   2. DÃ©finir les secrets VAPID de la fonction
--   3. Renseigner public.app_config (URL + token) â€” voir plus bas
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1) Abonnements push (un par appareil/navigateur)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: read own" on public.push_subscriptions;
create policy "push: read own"
  on public.push_subscriptions for select using (user_id = auth.uid());

drop policy if exists "push: insert own" on public.push_subscriptions;
create policy "push: insert own"
  on public.push_subscriptions for insert with check (user_id = auth.uid());

drop policy if exists "push: update own" on public.push_subscriptions;
create policy "push: update own"
  on public.push_subscriptions for update using (user_id = auth.uid());

drop policy if exists "push: delete own" on public.push_subscriptions;
create policy "push: delete own"
  on public.push_subscriptions for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) Config privÃ©e (URL de la fonction + token d'appel)
--    Aucun accÃ¨s anon/authenticated : seul le trigger SECURITY DEFINER lit.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- âš ï¸ Ã€ EXÃ‰CUTER MANUELLEMENT aprÃ¨s dÃ©ploiement de l'Edge Function
--    (remplacez <PROJECT_REF> et <SERVICE_ROLE_KEY>) :
--
-- insert into public.app_config(key, value) values
--   ('edge_send_push_url',   'https://<PROJECT_REF>.supabase.co/functions/v1/send-push'),
--   ('edge_send_push_token', '<SERVICE_ROLE_KEY>')
-- on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------
-- 3) DÃ©clencheur : Ã  chaque notification insÃ©rÃ©e, appeler l'Edge Function
-- ---------------------------------------------------------------------
create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url   text;
  v_token text;
begin
  select value into v_url   from public.app_config where key = 'edge_send_push_url';
  select value into v_token from public.app_config where key = 'edge_send_push_token';

  -- Pas encore configurÃ© : on ne bloque pas l'insertion de la notification
  if v_url is null then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_token, '')
    ),
    body    := jsonb_build_object(
      'user_id', new.user_id,
      'title',   new.title,
      'body',    new.body,
      'data',    new.data
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.tg_notifications_push();

-- ########## 0016_booking_cancel_reason.sql ##########

-- =====================================================================
-- Motif d'annulation + RPC passager (annulation fiable cÃ´tÃ© serveur)
-- =====================================================================

alter table public.bookings
  add column if not exists cancel_reason text;

create or replace function public.passenger_cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_booking record;
begin
  select b.id, b.passenger_id, b.status, b.trip_id, t.status as trip_status
    into v_booking
    from public.bookings b
    join public.trips t on t.id = b.trip_id
   where b.id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_booking.passenger_id is distinct from auth.uid() then
    raise exception 'not_allowed';
  end if;

  if v_booking.status in ('cancelled', 'completed') then
    raise exception 'already_closed';
  end if;

  if v_booking.trip_status in ('in_progress', 'completed', 'cancelled') then
    raise exception 'trip_already_started';
  end if;

  if v_booking.status = 'confirmed' and (p_reason is null or trim(p_reason) = '') then
    raise exception 'reason_required';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancel_reason = nullif(trim(p_reason), '')
   where id = p_booking_id;
end;
$$;

grant execute on function public.passenger_cancel_booking(uuid, text) to authenticated;

-- ########## 0017_end_trip_admin.sql ##########

-- =====================================================================
-- driver_end_trip : autoriser AUSSI l'administrateur Ã  terminer un voyage
-- (le chauffeur reste limitÃ© Ã  ses propres voyages ; cÃ´tÃ© UI il ne voit
--  le bouton qu'Ã  proximitÃ© de la destination â€” l'admin l'a toujours).
-- =====================================================================
create or replace function public.driver_end_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean := public.current_role_safe() = 'admin';
  v_trip public.trips%rowtype;
  v_driver uuid;
  b record;
  v_gross integer;
  v_comm integer;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  -- Admin : n'importe quel voyage ; chauffeur : uniquement les siens
  if v_is_admin then
    select * into v_trip from public.trips where id = p_trip_id;
  else
    select * into v_trip from public.trips where id = p_trip_id and driver_id = v_caller;
  end if;
  if not found then raise exception 'trip not found'; end if;

  v_driver := v_trip.driver_id;

  update public.trips
  set status = 'completed', ended_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = null where id = v_driver;

  for b in
    select bk.*, coalesce(t.distance_km, cp.distance_km, 0) as dist
    from public.bookings bk
    join public.trips t on t.id = bk.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where bk.trip_id = p_trip_id and bk.status = 'confirmed'
  loop
    v_gross := b.seats * v_trip.price_per_seat;
    v_comm := public.compute_commission(b.dist, v_trip.price_per_seat, b.seats);
    if not exists (select 1 from public.payments where booking_id = b.id) then
      insert into public.payments (
        booking_id, trip_id, passenger_id, driver_id,
        amount, commission, driver_earning, method, status, paid_at
      ) values (
        b.id, p_trip_id, b.passenger_id, v_driver,
        v_gross, v_comm, v_gross - v_comm, 'cash', 'paid', now()
      );
    end if;
    update public.bookings set status = 'completed' where id = b.id;

    if b.passenger_id is not null then
      perform public.notify_user(
        b.passenger_id,
        'Voyage terminÃ© âœ“',
        'Merci d''avoir voyagÃ© avec Easy Dunya. Code : ' || b.confirmation_code,
        'trip_completed',
        jsonb_build_object('trip_id', p_trip_id, 'booking_id', b.id)
      );
    end if;
  end loop;
end;
$$;

grant execute on function public.driver_end_trip(uuid) to authenticated;

-- ########## 0018_notify_driver_on_booking.sql ##########

-- =====================================================================
-- Notifier le CHAUFFEUR Ã  chaque nouvelle rÃ©servation, cÃ´tÃ© base.
-- Avant : la notif partait du client passager (Ã©chec si invitÃ© / non
-- connectÃ© car notify_user est rÃ©servÃ© aux "authenticated").
-- DÃ©sormais un trigger SECURITY DEFINER s'en charge â†’ fiable + push auto.
-- =====================================================================

create or replace function public.tg_booking_notify_driver()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_title  text;
begin
  select driver_id into v_driver from public.trips where id = new.trip_id;
  if v_driver is null then
    return new;
  end if;

  v_title := case
    when new.is_waiting then 'Nouvelle demande (liste d''attente)'
    else 'Nouvelle demande de rÃ©servation'
  end;

  perform public.notify_user(
    v_driver,
    v_title,
    new.seats || ' place(s) Â· code ' || new.confirmation_code,
    'booking_new',
    jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_booking_notify_driver on public.bookings;
create trigger trg_booking_notify_driver
  after insert on public.bookings
  for each row execute function public.tg_booking_notify_driver();

-- ########## 0019_fix_push_subscriptions_columns.sql ##########

-- =====================================================================
-- Aligner public.push_subscriptions sur le code (Web Push).
-- La table crÃ©Ã©e en 0001 utilisait "auth_key" et n'avait pas "user_agent".
-- Le client et l'Edge Function send-push attendent "auth" + "user_agent".
-- (0015 faisait "create table if not exists" => sans effet sur l'existant.)
-- =====================================================================

do $$
begin
  -- 1) Colonne "auth" : renommer auth_key -> auth si besoin, sinon crÃ©er
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth_key'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth'
  ) then
    alter table public.push_subscriptions rename column auth_key to auth;
  end if;

  -- Si ni auth ni auth_key n'existent (cas improbable), crÃ©er auth
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth'
  ) then
    alter table public.push_subscriptions add column auth text;
  end if;
end $$;

-- 2) Colonne user_agent (prÃ©sente dans 0015, absente de 0001)
alter table public.push_subscriptions
  add column if not exists user_agent text;

-- 3) Recharger le cache de schÃ©ma PostgREST (sinon erreur 400 persiste)
notify pgrst, 'reload schema';

-- 4) VÃ©rification
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'push_subscriptions'
order by ordinal_position;

-- ########## 0020_booking_notifications_fix.sql ##########

-- =====================================================================
-- Notifications rÃ©servations : 100 % cÃ´tÃ© serveur (fiable + push auto)
-- Corrige :
--   â€¢ Nouvelle rÃ©servation â†’ chauffeur (trigger insert)
--   â€¢ Acceptation / refus â†’ passager (trigger update)
--   â€¢ Annulation (avant ou aprÃ¨s acceptation) â†’ chauffeur (trigger update)
-- =====================================================================

-- 1) Nouvelle rÃ©servation â†’ chauffeur
create or replace function public.tg_booking_notify_driver()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_title  text;
begin
  select driver_id into v_driver from public.trips where id = new.trip_id;
  if v_driver is null then return new; end if;

  v_title := case
    when new.is_waiting then 'Nouvelle demande (liste d''attente)'
    else 'Nouvelle demande de rÃ©servation'
  end;

  perform public.notify_user(
    v_driver,
    v_title,
    new.seats || ' place(s) Â· code ' || new.confirmation_code,
    'booking_new',
    jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_booking_notify_driver on public.bookings;
create trigger trg_booking_notify_driver
  after insert on public.bookings
  for each row execute function public.tg_booking_notify_driver();

-- 2) Changement de statut â†’ passager et/ou chauffeur
create or replace function public.tg_booking_notify_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_body   text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Chauffeur confirme ou refuse â†’ notifier le passager
  if new.passenger_id is not null then
    if new.status = 'confirmed' then
      perform public.notify_user(
        new.passenger_id,
        'RÃ©servation confirmÃ©e âœ“',
        'Code : ' || new.confirmation_code,
        'booking_confirmed',
        jsonb_build_object('booking_id', new.id, 'trip_id', new.trip_id)
      );
    elsif new.status = 'rejected' then
      perform public.notify_user(
        new.passenger_id,
        'RÃ©servation refusÃ©e',
        'Code : ' || new.confirmation_code,
        'booking_rejected',
        jsonb_build_object('booking_id', new.id, 'trip_id', new.trip_id)
      );
    end if;
  end if;

  -- Passager annule (pending ou confirmed) â†’ notifier le chauffeur
  if new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
    select driver_id into v_driver from public.trips where id = new.trip_id;
    if v_driver is not null then
      v_body := new.seats || ' place(s) Â· code ' || new.confirmation_code;
      if new.cancel_reason is not null and trim(new.cancel_reason) <> '' then
        v_body := v_body || ' Â· Motif : ' || new.cancel_reason;
      end if;
      perform public.notify_user(
        v_driver,
        'RÃ©servation annulÃ©e par le passager',
        v_body,
        'booking_cancelled_by_passenger',
        jsonb_build_object(
          'booking_id', new.id,
          'trip_id', new.trip_id,
          'reason', new.cancel_reason
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_notify_status on public.bookings;
create trigger trg_booking_notify_status
  after update on public.bookings
  for each row execute function public.tg_booking_notify_status();

-- ########## 0021_fix_phone_taken_normalize.sql ##########

-- =====================================================================
-- EmpÃªcher l'Ã©crasement d'un compte existant (ex: admin demandÃ© en passager)
-- en comparant les numÃ©ros NORMALISÃ‰S (chiffres uniquement).
-- =====================================================================

create or replace function public.is_phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
            = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
       or regexp_replace(coalesce(u.email, ''), '\D', '', 'g')
            like regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') || '%'
  );
$$;

revoke all on function public.is_phone_taken(text) from public;
grant execute on function public.is_phone_taken(text) to anon, authenticated;

-- ########## 0022_device_tokens_fcm.sql ##########

-- =====================================================================
-- FCM NATIF : jetons d'appareils (APK Capacitor) + envoi automatique.
-- ComplÃ¨te le Web Push : sur l'app native, les notifications s'affichent
-- avec Â« Easy Dunya Â» + le logo, mÃªme application fermÃ©e.
--
-- PrÃ©-requis (voir supabase/functions/send-fcm) :
--   1. DÃ©ployer l'Edge Function `send-fcm`
--   2. DÃ©finir les secrets FCM de la fonction (compte de service Firebase)
--   3. Renseigner public.app_config (edge_send_fcm_url + token)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Jetons d'appareils (un par appareil natif)
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists idx_device_tokens_user
  on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "fcm: read own" on public.device_tokens;
create policy "fcm: read own"
  on public.device_tokens for select using (user_id = auth.uid());

drop policy if exists "fcm: insert own" on public.device_tokens;
create policy "fcm: insert own"
  on public.device_tokens for insert with check (user_id = auth.uid());

drop policy if exists "fcm: update own" on public.device_tokens;
create policy "fcm: update own"
  on public.device_tokens for update using (user_id = auth.uid());

drop policy if exists "fcm: delete own" on public.device_tokens;
create policy "fcm: delete own"
  on public.device_tokens for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) DÃ©clencheur : Ã  chaque notification insÃ©rÃ©e, appeler send-push
--    (web) ET send-fcm (natif) si configurÃ©s.
-- ---------------------------------------------------------------------
create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url      text;
  v_token    text;
  v_fcm_url  text;
  v_fcm_tok  text;
  v_payload  jsonb;
begin
  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   new.title,
    'body',    new.body,
    'data',    new.data
  );

  -- Web Push (navigateur / PWA)
  select value into v_url   from public.app_config where key = 'edge_send_push_url';
  select value into v_token from public.app_config where key = 'edge_send_push_token';
  if v_url is not null then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_token, '')
      ),
      body    := v_payload
    );
  end if;

  -- FCM natif (APK Capacitor)
  select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
  select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
  if v_fcm_url is not null then
    perform net.http_post(
      url     := v_fcm_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
      ),
      body    := v_payload
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.tg_notifications_push();

-- ---------------------------------------------------------------------
-- 3) Config Ã  exÃ©cuter MANUELLEMENT aprÃ¨s dÃ©ploiement de send-fcm :
--
-- insert into public.app_config(key, value) values
--   ('edge_send_fcm_url',   'https://<PROJECT_REF>.supabase.co/functions/v1/send-fcm'),
--   ('edge_send_fcm_token', '<SERVICE_ROLE_KEY>')
-- on conflict (key) do update set value = excluded.value;
-- ---------------------------------------------------------------------

-- ########## 0023_passenger_location.sql ##########

-- Localisation passager (quartier + GPS) pour les prises en charge sur la carte.
alter table public.profiles
  add column if not exists quartier text,
  add column if not exists city_label text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_updated_at timestamptz;

-- ########## 0024_driver_read_passenger_profiles.sql ##########

-- Le chauffeur peut lire le profil (nom, tÃ©lÃ©phoneâ€¦) des passagers
-- ayant une rÃ©servation sur l'un de ses voyages.
drop policy if exists "profiles: driver read booking passengers" on public.profiles;
create policy "profiles: driver read booking passengers"
  on public.profiles for select
  using (
    role = 'passenger'
    and exists (
      select 1
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      where b.passenger_id = profiles.id
        and t.driver_id = auth.uid()
    )
  );

-- Remplir guest_name / guest_phone pour les rÃ©servations existantes
update public.bookings b
set
  guest_name = coalesce(b.guest_name, p.full_name),
  guest_phone = coalesce(b.guest_phone, p.phone)
from public.profiles p
where b.passenger_id = p.id
  and (b.guest_name is null or b.guest_phone is null);

-- ########## 0025_welcome_first_booking_notifications.sql ##########

-- =====================================================================
-- 0025 â€” Notifications bienvenue (inscription) + 1Ê³áµ‰ rÃ©servation
-- =====================================================================

-- 1) Bienvenue Ã  la crÃ©ation du profil (inscription passager/chauffeur)
create or replace function public.tg_profile_welcome_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_user(
    new.id,
    'Merci de faire partie de la famille Easy Dunya',
    null,
    'welcome',
    jsonb_build_object('profile_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_profile_welcome_notify on public.profiles;
create trigger trg_profile_welcome_notify
  after insert on public.profiles
  for each row
  execute function public.tg_profile_welcome_notify();

-- 2) PremiÃ¨re rÃ©servation : notification Â« 100 premiers voyageurs Â»
--    â€¢ uniquement Ã  la 1Ê³áµ‰ rÃ©servation du passager
--    â€¢ uniquement tant qu'il n'y a pas plus de 100 passagers inscrits (role = passenger)
create or replace function public.tg_booking_notify_passenger_first()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passenger_count integer;
begin
  if new.passenger_id is null then
    return new;
  end if;

  -- Pas la premiÃ¨re rÃ©servation de ce passager â†’ rien
  if exists (
    select 1
    from public.bookings b
    where b.passenger_id = new.passenger_id
      and b.id <> new.id
  ) then
    return new;
  end if;

  -- Limite : pas plus de 100 passagers inscrits sur la plateforme
  select count(*)
  into v_passenger_count
  from public.profiles
  where role = 'passenger';

  if v_passenger_count > 100 then
    return new;
  end if;

  perform public.notify_user(
    new.passenger_id,
    'Vous faites partie des 100 premiers voyageurs Easy Dunya.',
    null,
    'first_booking',
    jsonb_build_object(
      'booking_id', new.id,
      'trip_id', new.trip_id,
      'passenger_count', v_passenger_count
    )
  );

  return new;
end;
$$;

-- Attacher le trigger bookings seulement si la table existe (Ã©vite erreur sur projet incomplet)
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'bookings'
  ) then
    raise notice '0025 : table bookings absente â€” trigger premiÃ¨re rÃ©servation ignorÃ©.';
    return;
  end if;

  execute 'drop trigger if exists trg_booking_notify_passenger_first on public.bookings';
  execute '
    create trigger trg_booking_notify_passenger_first
      after insert on public.bookings
      for each row
      execute function public.tg_booking_notify_passenger_first()';
end $$;
