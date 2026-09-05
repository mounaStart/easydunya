-- =====================================================================
-- 0042 — Entrées routières PAR PAIRE (source → destination)
-- from_entrance_* = sortie / entrée côté départ sur l'axe du trajet
-- to_entrance_*   = entrée destination (PK, limite ville) — fin à 500 m
-- Remplace le calcul centre-ville → centre-ville (bug ~1,4 km à l'entrée)
-- =====================================================================

alter table public.city_prices
  add column if not exists from_entrance_lat double precision,
  add column if not exists from_entrance_lng double precision,
  add column if not exists to_entrance_lat double precision,
  add column if not exists to_entrance_lng double precision;

comment on column public.city_prices.from_entrance_lat is
  'Entrée/sortie routière ville départ pour ce trajet (pas le centre)';
comment on column public.city_prices.to_entrance_lat is
  'Entrée routière ville destination — fin auto voyage à 500 m';

-- Trajets retour (si absents)
insert into public.city_prices (from_city_id, to_city_id, price_per_seat, distance_km)
select ct.id, cf.id, cp.price_per_seat, cp.distance_km
from public.city_prices cp
join public.cities cf on cf.id = cp.from_city_id
join public.cities ct on ct.id = cp.to_city_id
where cf.name_fr = 'Nouakchott'
  and ct.name_fr in ('Aleg', 'Rosso', 'Nouadhibou')
on conflict (from_city_id, to_city_id) do nothing;

-- Entrées OSRM + repères connus (PK Madrid, SG Tevragh, etc.)
-- Nouakchott → …
update public.city_prices cp set from_entrance_lat=18.0818, from_entrance_lng=-15.9639, to_entrance_lat=20.9456, to_entrance_lng=-17.0350
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Nouadhibou';

update public.city_prices cp set from_entrance_lat=18.0681, from_entrance_lng=-15.9700, to_entrance_lat=16.5223, to_entrance_lng=-15.8109
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Rosso';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=16.5925, to_entrance_lng=-14.2756
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Boghé';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=16.1487, to_entrance_lng=-13.5110
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Kaédi';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=17.0522, to_entrance_lng=-13.9179
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Aleg';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=16.6167, to_entrance_lng=-11.4144
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Kiffa';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=16.6610, to_entrance_lng=-9.6204
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Aioun';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=16.6126, to_entrance_lng=-7.2579
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Néma';

update public.city_prices cp set from_entrance_lat=18.0818, from_entrance_lng=-15.9639, to_entrance_lat=20.5146, to_entrance_lng=-13.0550
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Atar';

update public.city_prices cp set from_entrance_lat=18.0818, from_entrance_lng=-15.9639, to_entrance_lat=22.7268, to_entrance_lng=-12.4786
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Zouérat';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=15.1699, to_entrance_lng=-12.1902
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Sélibaby';

update public.city_prices cp set from_entrance_lat=18.0730, from_entrance_lng=-15.9430, to_entrance_lat=18.5421, to_entrance_lng=-11.4415
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Tidjikja';

update public.city_prices cp set from_entrance_lat=18.0620, from_entrance_lng=-15.9498, to_entrance_lat=18.0453, to_entrance_lng=-15.9306
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Arafat';

update public.city_prices cp set from_entrance_lat=18.0681, from_entrance_lng=-15.9700, to_entrance_lat=18.0954, to_entrance_lng=-15.9761
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouakchott' and ct.name_fr='Tevragh Zeina';

update public.city_prices cp set from_entrance_lat=18.0462, from_entrance_lng=-15.9183, to_entrance_lat=18.0954, to_entrance_lng=-15.9761
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Arafat' and ct.name_fr='Tevragh Zeina';

-- Retours vers Nouakchott (PK RN2 avant Madrid)
update public.city_prices cp set from_entrance_lat=17.0522, from_entrance_lng=-13.9179, to_entrance_lat=18.0681, to_entrance_lng=-15.9700
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Aleg' and ct.name_fr='Nouakchott';

update public.city_prices cp set from_entrance_lat=16.5223, from_entrance_lng=-15.8109, to_entrance_lat=18.0681, to_entrance_lng=-15.9700
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Rosso' and ct.name_fr='Nouakchott';

update public.city_prices cp set from_entrance_lat=20.9456, from_entrance_lng=-17.0350, to_entrance_lat=18.0818, to_entrance_lng=-15.9639
from public.cities cf, public.cities ct where cp.from_city_id=cf.id and cp.to_city_id=ct.id and cf.name_fr='Nouadhibou' and ct.name_fr='Nouakchott';

-- Vue : itinéraire entrée source → entrée destination
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
  coalesce(cp.from_entrance_lat, cf.latitude)  as from_lat,
  coalesce(cp.from_entrance_lng, cf.longitude) as from_lng,
  t.to_city_id,
  ct.name_fr            as to_name_fr,
  ct.name_ar            as to_name_ar,
  coalesce(cp.to_entrance_lat, ct.latitude)    as to_lat,
  coalesce(cp.to_entrance_lng, ct.longitude)    as to_lng,
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
  coalesce(t.depart_lat, cp.from_entrance_lat, cf.latitude)  as depart_lat,
  coalesce(t.depart_lng, cp.from_entrance_lng, cf.longitude) as depart_lng,
  t.depart_quartier     as depart_quartier,
  coalesce(
    t.distance_km,
    cp.distance_km,
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    0
  )                     as distance_km
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
left join public.city_prices cp
  on cp.from_city_id = t.from_city_id and cp.to_city_id = t.to_city_id
where d.gps_consent is true;

-- Fin auto : destination = entrée ville (paire), pas centre
create or replace function public.driver_update_gps(
  p_trip_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_route_remaining_m double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_dest record;
  v_dist_km numeric := null;
  v_completed boolean := false;
begin
  if v_driver is null then
    raise exception 'not authenticated';
  end if;

  insert into public.driver_positions (trip_id, driver_id, latitude, longitude)
  values (p_trip_id, v_driver, p_lat, p_lng);

  select
    t.id,
    t.driver_id,
    t.status,
    coalesce(cp.to_entrance_lat, ct.latitude) as dest_lat,
    coalesce(cp.to_entrance_lng, ct.longitude) as dest_lng
  into v_dest
  from public.trips t
  join public.cities ct on ct.id = t.to_city_id
  left join public.city_prices cp
    on cp.from_city_id = t.from_city_id and cp.to_city_id = t.to_city_id
  where t.id = p_trip_id
    and t.driver_id = v_driver
    and t.status = 'in_progress';

  if found
    and v_dest.dest_lat is not null
    and v_dest.dest_lng is not null
  then
    v_dist_km := 6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(v_dest.dest_lat))
        * cos(radians(v_dest.dest_lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(v_dest.dest_lat))
      ))
    );

    if p_route_remaining_m is not null and p_route_remaining_m <= 500 then
      perform public.driver_end_trip(p_trip_id);
      v_completed := true;
    elsif v_dist_km <= 0.5 then
      perform public.driver_end_trip(p_trip_id);
      v_completed := true;
    end if;
  end if;

  return jsonb_build_object(
    'completed', v_completed,
    'unlocked', v_completed,
    'distance_km', round(coalesce(v_dist_km, 0)::numeric, 2),
    'route_remaining_m', round(coalesce(p_route_remaining_m, 0)::numeric, 0)
  );
end;
$$;

grant execute on function public.driver_update_gps(uuid, double precision, double precision, double precision) to authenticated;
