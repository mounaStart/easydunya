-- Publication de voyage : le chauffeur authentifié insère ses propres lignes.
-- current_role_safe() dans WITH CHECK refusait l'INSERT si le jeton / le profil
-- n'était pas lu (cas fréquent sur iOS WKWebView).
drop policy if exists "trips: driver insert own" on public.trips;
create policy "trips: driver insert own"
  on public.trips for insert
  with check (driver_id = auth.uid());
