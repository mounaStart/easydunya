-- =====================================================================
-- 0044 — Entrée Nouakchott axe Aleg (Rue de l'Espoir, avant Toujounine)
-- Point sur RN2 / Rue de l'Espoir où la route arrive de l'est (Aleg)
-- PK RN2 nord (18.0681) reste pour Rosso / sud
-- =====================================================================

-- Entrée par défaut Nouakchott (axe est)
update public.cities
set entry_lat = 18.0583, entry_lng = -15.8652
where name_fr = 'Nouakchott';

-- Paires vers Nouakchott depuis l'est (Aleg, Kaédi, Boghé…)
update public.city_prices cp set
  to_entrance_lat = 18.0583, to_entrance_lng = -15.8652
from public.cities cf, public.cities ct
where cp.from_city_id = cf.id and cp.to_city_id = ct.id
  and ct.name_fr = 'Nouakchott'
  and cf.name_fr in ('Aleg', 'Kaédi', 'Boghé', 'Kiffa', 'Aioun', 'Néma', 'Sélibaby');

-- Paires depuis le sud (Rosso) — PK RN2 / Madrid
update public.city_prices cp set
  to_entrance_lat = 18.0681, to_entrance_lng = -15.9700
from public.cities cf, public.cities ct
where cp.from_city_id = cf.id and cp.to_city_id = ct.id
  and cf.name_fr = 'Rosso' and ct.name_fr = 'Nouakchott';

-- Paires depuis le nord (Nouadhibou)
update public.city_prices cp set
  to_entrance_lat = 18.0818, to_entrance_lng = -15.9639
from public.cities cf, public.cities ct
where cp.from_city_id = cf.id and cp.to_city_id = ct.id
  and cf.name_fr = 'Nouadhibou' and ct.name_fr = 'Nouakchott';

-- Départs depuis Nouakchott vers l'est
update public.city_prices cp set
  from_entrance_lat = 18.0583, from_entrance_lng = -15.8652
from public.cities cf, public.cities ct
where cp.from_city_id = cf.id and cp.to_city_id = ct.id
  and cf.name_fr = 'Nouakchott'
  and ct.name_fr in ('Aleg', 'Kaédi', 'Boghé', 'Kiffa', 'Aioun', 'Néma', 'Sélibaby');

-- Départs depuis Nouakchott vers Rosso (sud)
update public.city_prices cp set
  from_entrance_lat = 18.0681, from_entrance_lng = -15.9700
from public.cities cf, public.cities ct
where cp.from_city_id = cf.id and cp.to_city_id = ct.id
  and cf.name_fr = 'Nouakchott' and ct.name_fr = 'Rosso';
