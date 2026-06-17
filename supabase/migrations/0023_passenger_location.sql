-- Localisation passager (quartier + GPS) pour les prises en charge sur la carte.
alter table public.profiles
  add column if not exists quartier text,
  add column if not exists city_label text,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_updated_at timestamptz;
