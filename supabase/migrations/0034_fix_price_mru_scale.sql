-- =====================================================================
-- 0034 — Tarifs MRU : échelle correcte (ex. 5000 → 500 MRU / place)
-- Les tarifs city_prices avaient un zéro en trop.
-- =====================================================================

update public.city_prices
set price_per_seat = greatest(1, (price_per_seat / 10)::integer)
where price_per_seat >= 1000;

-- Voyages déjà publiés avec le même écart (optionnel mais cohérent à l'affichage)
update public.trips
set price_per_seat = greatest(1, (price_per_seat / 10)::integer)
where price_per_seat >= 1000
  and status = 'scheduled';
