-- =====================================================================
-- 0040 — Tevragh Zeina : point d'arrivée = Société Générale,
--        carrefour Mokhtar Ould Daddah (Avenue du Général de Gaulle)
-- Coords OSM amenity=bank « Société Générale » (Chamal, Tevragh Zeina)
-- =====================================================================

update public.cities
set
  latitude = 18.0954,
  longitude = -15.9761
where name_fr = 'Tevragh Zeina';
