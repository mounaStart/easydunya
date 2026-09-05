-- =====================================================================
-- 0041 — Points d'arrivée = ENTRÉE de ville (pas centre administratif)
-- Fin auto à 500 m + distance restante alignées sur l'entrée routière
-- (PK avant Carrefour Madrid pour Nouakchott axe Rosso ; ~1,4 km avant
--  le centre OSM sur l'axe Nouakchott pour les autres villes interurbaines)
-- =====================================================================

update public.cities set latitude = 18.0681, longitude = -15.9700
where name_fr = 'Nouakchott';

update public.cities set latitude = 17.0522, longitude = -13.9179
where name_fr = 'Aleg';

update public.cities set latitude = 16.5223, longitude = -15.8109
where name_fr = 'Rosso';

update public.cities set latitude = 20.9456, longitude = -17.0350
where name_fr = 'Nouadhibou';

update public.cities set latitude = 16.5925, longitude = -14.2756
where name_fr = 'Boghé';

update public.cities set latitude = 16.1487, longitude = -13.5110
where name_fr = 'Kaédi';

update public.cities set latitude = 16.6167, longitude = -11.4144
where name_fr = 'Kiffa';

update public.cities set latitude = 16.6610, longitude = -9.6204
where name_fr = 'Aioun';

update public.cities set latitude = 16.6126, longitude = -7.2579
where name_fr = 'Néma';

update public.cities set latitude = 20.5146, longitude = -13.0550
where name_fr = 'Atar';

update public.cities set latitude = 22.7268, longitude = -12.4786
where name_fr = 'Zouérat';

update public.cities set latitude = 15.1699, longitude = -12.1902
where name_fr = 'Sélibaby';

update public.cities set latitude = 18.5421, longitude = -11.4415
where name_fr = 'Tidjikja';

-- Tevragh Zeina / Arafat : repères quartier (0038/0040), inchangés ici
