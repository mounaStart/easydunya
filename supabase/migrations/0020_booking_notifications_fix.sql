-- =====================================================================
-- Notifications réservations : 100 % côté serveur (fiable + push auto)
-- Corrige :
--   • Nouvelle réservation → chauffeur (trigger insert)
--   • Acceptation / refus → passager (trigger update)
--   • Annulation (avant ou après acceptation) → chauffeur (trigger update)
-- =====================================================================

-- 1) Nouvelle réservation → chauffeur
create or replace function public.tg_booking_notify_driver()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_title  text;
begin
  select driver_id into v_driver from public.trips where id = new.trip_id;
  if v_driver is null then return new; end if;

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

-- 2) Changement de statut → passager et/ou chauffeur
create or replace function public.tg_booking_notify_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_driver uuid;
  v_body   text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  -- Chauffeur confirme ou refuse → notifier le passager
  if new.passenger_id is not null then
    if new.status = 'confirmed' then
      perform public.notify_user(
        new.passenger_id,
        'Réservation confirmée ✓',
        'Code : ' || new.confirmation_code,
        'booking_confirmed',
        jsonb_build_object('booking_id', new.id, 'trip_id', new.trip_id)
      );
    elsif new.status = 'rejected' then
      perform public.notify_user(
        new.passenger_id,
        'Réservation refusée',
        'Code : ' || new.confirmation_code,
        'booking_rejected',
        jsonb_build_object('booking_id', new.id, 'trip_id', new.trip_id)
      );
    end if;
  end if;

  -- Passager annule (pending ou confirmed) → notifier le chauffeur
  if new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
    select driver_id into v_driver from public.trips where id = new.trip_id;
    if v_driver is not null then
      v_body := new.seats || ' place(s) · code ' || new.confirmation_code;
      if new.cancel_reason is not null and trim(new.cancel_reason) <> '' then
        v_body := v_body || ' · Motif : ' || new.cancel_reason;
      end if;
      perform public.notify_user(
        v_driver,
        'Réservation annulée par le passager',
        v_body,
        'booking_cancelled_by_passenger',
        jsonb_build_object(
          'booking_id', new.id,
          'trip_id', new.trip_id,
          'reason', new.cancel_reason
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_booking_notify_status on public.bookings;
create trigger trg_booking_notify_status
  after update on public.bookings
  for each row execute function public.tg_booking_notify_status();
