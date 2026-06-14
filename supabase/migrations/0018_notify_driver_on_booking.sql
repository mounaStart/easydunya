-- =====================================================================
-- Notifier le CHAUFFEUR à chaque nouvelle réservation, côté base.
-- Avant : la notif partait du client passager (échec si invité / non
-- connecté car notify_user est réservé aux "authenticated").
-- Désormais un trigger SECURITY DEFINER s'en charge → fiable + push auto.
-- =====================================================================

create or replace function public.tg_booking_notify_driver()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_title  text;
begin
  select driver_id into v_driver from public.trips where id = new.trip_id;
  if v_driver is null then
    return new;
  end if;

  v_title := case
    when new.is_waiting then 'Nouvelle demande (liste d''attente)'
    else 'Nouvelle demande de réservation'
  end;

  perform public.notify_user(
    v_driver,
    v_title,
    new.seats || ' place(s) · code ' || new.confirmation_code,
    'booking_new',
    jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_booking_notify_driver on public.bookings;
create trigger trg_booking_notify_driver
  after insert on public.bookings
  for each row execute function public.tg_booking_notify_driver();
