-- Tevragh Zeina : Société Générale, carrefour Mokhtar Ould Daddah
-- (Avenue du Général de Gaulle — coords OSM amenity=bank)

insert into public.cities (id, name_fr, name_ar, region, latitude, longitude) values
  (
    '11111111-1111-1111-1111-000000000014',
    'Arafat',
    'عرفات',
    'Nouakchott',
    18.0462,
    -15.9183
  ),
  (
    '11111111-1111-1111-1111-000000000015',
    'Tevragh Zeina',
    'تفرغ زينة',
    'Nouakchott',
    18.0954,
    -15.9761
  )
on conflict (id) do update set
  name_fr = excluded.name_fr,
  name_ar = excluded.name_ar,
  region = excluded.region,
  latitude = excluded.latitude,
  longitude = excluded.longitude;

-- Tarifs depuis Nouakchott centre (si table city_prices existe)
insert into public.city_prices (from_city_id, to_city_id, price_per_seat, distance_km)
select
  nkc.id,
  q.id,
  case q.name_fr when 'Arafat' then 200 when 'Tevragh Zeina' then 150 else 200 end,
  case q.name_fr when 'Arafat' then 12.0 when 'Tevragh Zeina' then 8.0 else 10.0 end
from public.cities nkc
cross join public.cities q
where nkc.name_fr = 'Nouakchott'
  and q.name_fr in ('Arafat', 'Tevragh Zeina')
on conflict (from_city_id, to_city_id) do update set
  price_per_seat = excluded.price_per_seat,
  distance_km = excluded.distance_km;

-- Tarif Arafat → Tevragh Zeina (trajet intra-Nouakchott)
insert into public.city_prices (from_city_id, to_city_id, price_per_seat, distance_km)
select
  ar.id,
  tz.id,
  150,
  10.0
from public.cities ar
join public.cities tz on tz.name_fr = 'Tevragh Zeina'
where ar.name_fr = 'Arafat'
on conflict (from_city_id, to_city_id) do update set
  price_per_seat = excluded.price_per_seat,
  distance_km = excluded.distance_km;
