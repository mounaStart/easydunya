-- =====================================================================
-- 0047 — Agences partenaires (schéma cible)
-- V1 de l'app utilise un store local (démo cliquable) ; ces tables
-- serviront à la bascule SQL sans toucher user_role (admin Easy Dunya ≠ admin agence).
-- =====================================================================

create table if not exists public.agencies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  contact       text,
  address       text not null default '',
  city          text not null default 'Nouakchott',
  phone         text,
  whatsapp      text,
  email         text,
  logo          text,
  cancel_hours  integer not null default 3,
  cancel_fee    integer not null default 20,
  two_fa        boolean not null default false,
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'suspended')),
  created_at    timestamptz not null default now()
);

create table if not exists public.agency_points (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  name       text not null,
  address    text not null default '',
  phone      text,
  active     boolean not null default true
);

create table if not exists public.agency_staff (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  login       text not null unique,
  email       text not null,
  password    text not null,
  name        text not null,
  role        text not null check (role in ('admin', 'agent')),
  point_id    text not null default 'principal',
  perms       text[] not null default '{}',
  active      boolean not null default true,
  last_login  timestamptz
);

create table if not exists public.agency_vehicles (
  id         uuid primary key default gen_random_uuid(),
  agency_id  uuid not null references public.agencies(id) on delete cascade,
  brand      text not null,
  model      text not null,
  plate      text not null,
  seats      integer not null check (seats between 1 and 60),
  year       integer not null default 2015,
  available  boolean not null default true,
  active     boolean not null default true
);

create table if not exists public.agency_drivers (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  first_name  text not null,
  last_name   text not null,
  phone       text not null,
  photo       text,
  vehicle_id  uuid references public.agency_vehicles(id) on delete set null,
  active      boolean not null default true
);

create table if not exists public.agency_trips (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  from_city_id uuid not null references public.cities(id),
  to_city_id   uuid not null references public.cities(id),
  from_name    text not null,
  to_name      text not null,
  depart_at    timestamptz not null,
  price        integer not null check (price > 0),
  vehicle_id   uuid not null references public.agency_vehicles(id),
  driver_id    uuid references public.agency_drivers(id) on delete set null,
  seats        integer not null check (seats between 1 and 60),
  meeting      text not null default '',
  notes        text,
  status       text not null default 'publie' check (status in ('publie', 'annule'))
);

create table if not exists public.agency_bookings (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  agency_id     uuid not null references public.agencies(id) on delete cascade,
  trip_id       uuid not null references public.agency_trips(id) on delete cascade,
  passenger     text not null,
  phone         text not null,
  seats         integer not null check (seats >= 1),
  seat_nos      integer[] not null,
  total         integer not null,
  channel       text not null check (channel in ('app', 'guichet', 'sous')),
  point_id      text not null,
  agent_id      uuid references public.agency_staff(id) on delete set null,
  status        text not null check (status in ('attente', 'confirmee', 'annulee', 'terminee')),
  pay           text not null,
  pay_method    text,
  created_at    timestamptz not null default now(),
  boarded       boolean not null default false,
  boarded_at    timestamptz,
  refund        integer,
  cancel_reason text,
  cancelled_at  timestamptz
);

create index if not exists idx_agency_trips_depart on public.agency_trips(depart_at);
create index if not exists idx_agency_bookings_trip on public.agency_bookings(trip_id);
create index if not exists idx_agency_bookings_code on public.agency_bookings(code);

alter table public.agencies enable row level security;
alter table public.agency_points enable row level security;
alter table public.agency_staff enable row level security;
alter table public.agency_vehicles enable row level security;
alter table public.agency_drivers enable row level security;
alter table public.agency_trips enable row level security;
alter table public.agency_bookings enable row level security;

-- Lecture publique des départs publiés (liste passager) — à activer plus tard
-- avec une vue. V1 : pas de policy d'écriture (service role / SQL editor).

comment on table public.agencies is
  'Agences partenaires Easy Dunya. Le personnel agence n''est pas un admin Easy Dunya.';
