-- =====================================================================
-- EASY DUNYA — Lecture d'une réservation par son code de confirmation
-- La policy RLS "bookings: read own" ne permet de lire que ses propres
-- réservations (passager) ou celles de ses voyages (chauffeur).
-- Pour permettre le suivi d'une réservation à partir de son CODE
-- (page Réservation / Vérifier), on expose une fonction SECURITY DEFINER
-- qui ne renvoie qu'UNE ligne correspondant exactement au code fourni.
-- Le code de confirmation joue alors le rôle de "clé d'accès".
-- =====================================================================

create or replace function public.get_booking_by_code(p_code text)
returns table (
  id                uuid,
  trip_id           uuid,
  passenger_id      uuid,
  guest_name        text,
  guest_phone       text,
  seats             integer,
  confirmation_code text,
  status            public.booking_status,
  created_at        timestamptz,
  updated_at        timestamptz
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.trip_id, b.passenger_id, b.guest_name, b.guest_phone,
         b.seats, b.confirmation_code, b.status, b.created_at, b.updated_at
  from public.bookings b
  where b.confirmation_code = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.get_booking_by_code(text) from public;
grant execute on function public.get_booking_by_code(text) to anon, authenticated;
