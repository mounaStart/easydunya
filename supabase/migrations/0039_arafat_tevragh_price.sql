-- Tarif Arafat → Tevragh Zeina (si 0038 déjà appliquée sans ce bloc)
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
