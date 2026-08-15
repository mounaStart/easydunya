-- =====================================================================
-- 0027 — Corrections V1-3 (Maimouna)
--   • Encodage UTF-8 des notifications (dÃ©marrÃ© → démarré)
--   • Réapplication fiable des triggers réservation / démarrage voyage
--   • distance_km exposé dans trips_public (affichage passager)
-- =====================================================================

-- 1) Vue trips_public : ajouter distance_km
create or replace view public.trips_public as
select
  t.id,
  t.driver_id,
  d.full_name           as driver_name,
  d.rating_avg          as driver_rating,
  d.rating_count        as driver_rating_count,
  nullif(trim(concat_ws(' ', v.make, v.model)), '') as vehicle_label,
  v.plate               as vehicle_plate,
  v.seats               as vehicle_seats,
  t.from_city_id,
  cf.name_fr            as from_name_fr,
  cf.name_ar            as from_name_ar,
  cf.latitude           as from_lat,
  cf.longitude          as from_lng,
  t.to_city_id,
  ct.name_fr            as to_name_fr,
  ct.name_ar            as to_name_ar,
  ct.latitude           as to_lat,
  ct.longitude          as to_lng,
  t.depart_at,
  t.price_per_seat,
  t.seats_total,
  t.seats_available,
  t.notes,
  t.status,
  t.started_at,
  t.ended_at,
  t.created_at,
  v.make                as vehicle_make,
  d.photo_url           as driver_photo,
  coalesce(t.depart_lat, cf.latitude)  as depart_lat,
  coalesce(t.depart_lng, cf.longitude) as depart_lng,
  t.depart_quartier     as depart_quartier,
  coalesce(
    t.distance_km,
    cp.distance_km,
    public.cities_distance_km(t.from_city_id, t.to_city_id),
    0
  )                     as distance_km
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id
left join public.city_prices cp on cp.id = t.city_price_id;

-- 2) driver_start_trip : textes UTF-8 corrects
create or replace function public.driver_start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_locked uuid;
  b record;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;
  if v_trip.status <> 'scheduled' then raise exception 'trip not scheduled'; end if;

  select current_trip_id into v_locked from public.profiles where id = v_driver;
  if v_locked is not null then
    if exists (select 1 from public.trips where id = v_locked and status = 'in_progress') then
      raise exception 'driver already engaged on another trip';
    end if;
    update public.profiles set current_trip_id = null where id = v_driver;
  end if;

  update public.trips
  set status = 'in_progress', started_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = p_trip_id where id = v_driver;

  for b in
    select id, passenger_id, confirmation_code
    from public.bookings
    where trip_id = p_trip_id and status = 'confirmed' and passenger_id is not null
  loop
    perform public.notify_user(
      b.passenger_id,
      'Le chauffeur a démarré le voyage 🚗',
      'Votre trajet est en cours. Code : ' || b.confirmation_code,
      'trip_started',
      jsonb_build_object('trip_id', p_trip_id, 'booking_id', b.id)
    );
  end loop;
end;
$$;

-- 3) Notifications réservation : réapplication UTF-8
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

-- 4) Nettoyage des notifications déjà enregistrées avec mauvais encodage
update public.notifications
set title = 'Le chauffeur a démarré le voyage 🚗'
where title like '%dÃ©marr%' or title like '%dÃ©marrÃ©%';

update public.notifications
set title = 'Réservation confirmée ✓'
where title like '%RÃ©servation confirm%';

update public.notifications
set title = 'Réservation refusée'
where title like '%RÃ©servation refus%';

update public.notifications
set title = 'Voyage terminé ✓'
where title like '%Voyage termin%Ã©%';
