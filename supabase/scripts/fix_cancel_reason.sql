-- =====================================================================
-- Réparer l'annulation passager (motif + RPC)
-- À exécuter dans Supabase → SQL Editor si l'annulation échoue.
-- =====================================================================

alter table public.bookings
  add column if not exists cancel_reason text;

create or replace function public.passenger_cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_booking record;
begin
  select b.id, b.passenger_id, b.status, b.trip_id, t.status as trip_status
    into v_booking
    from public.bookings b
    join public.trips t on t.id = b.trip_id
   where b.id = p_booking_id;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_booking.passenger_id is distinct from auth.uid() then
    raise exception 'not_allowed';
  end if;

  if v_booking.status in ('cancelled', 'completed') then
    raise exception 'already_closed';
  end if;

  if v_booking.trip_status in ('in_progress', 'completed', 'cancelled') then
    raise exception 'trip_already_started';
  end if;

  if v_booking.status = 'confirmed' and (p_reason is null or trim(p_reason) = '') then
    raise exception 'reason_required';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancel_reason = nullif(trim(p_reason), '')
   where id = p_booking_id;
end;
$$;

grant execute on function public.passenger_cancel_booking(uuid, text) to authenticated;

-- Vérification
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'bookings'
  and column_name = 'cancel_reason';
