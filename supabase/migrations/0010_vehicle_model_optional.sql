-- =====================================================================
-- 0010 — Le modèle de véhicule devient optionnel
-- (à la création d'un chauffeur, l'admin saisit marque + plaque + places)
-- =====================================================================

alter table public.vehicles
  alter column model drop not null;

-- L'admin peut créer/gérer les véhicules de n'importe quel chauffeur
-- (création de compte chauffeur + véhicule en une seule étape).
drop policy if exists "vehicles: admin crud" on public.vehicles;
create policy "vehicles: admin crud"
  on public.vehicles for all
  using (public.current_role_safe() = 'admin')
  with check (public.current_role_safe() = 'admin');
