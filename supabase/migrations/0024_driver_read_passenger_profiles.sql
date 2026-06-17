-- Le chauffeur peut lire le profil (nom, téléphone…) des passagers
-- ayant une réservation sur l'un de ses voyages.
drop policy if exists "profiles: driver read booking passengers" on public.profiles;
create policy "profiles: driver read booking passengers"
  on public.profiles for select
  using (
    role = 'passenger'
    and exists (
      select 1
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      where b.passenger_id = profiles.id
        and t.driver_id = auth.uid()
    )
  );

-- Remplir guest_name / guest_phone pour les réservations existantes
update public.bookings b
set
  guest_name = coalesce(b.guest_name, p.full_name),
  guest_phone = coalesce(b.guest_phone, p.phone)
from public.profiles p
where b.passenger_id = p.id
  and (b.guest_name is null or b.guest_phone is null);
