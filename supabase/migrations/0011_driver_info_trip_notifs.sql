-- =====================================================================
-- 0011 — Photo chauffeur, vue enrichie + notifications démarrage/fin voyage
-- =====================================================================

-- 1) Photo de profil (chauffeur) — optionnelle
alter table public.profiles add column if not exists photo_url text;

-- 2) Vue trips_public enrichie :
--    - vehicle_label robuste (modèle désormais optionnel)
--    - vehicle_make (marque seule) + driver_photo (photo chauffeur)
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
  -- nouvelles colonnes (ajoutées à la fin)
  v.make                as vehicle_make,
  d.photo_url           as driver_photo
from public.trips t
join public.profiles d on d.id = t.driver_id
left join public.vehicles v on v.id = t.vehicle_id
join public.cities cf on cf.id = t.from_city_id
join public.cities ct on ct.id = t.to_city_id;

-- 3) driver_start_trip : notifie les passagers confirmés du démarrage
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

  -- Notifier chaque passager confirmé
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
grant execute on function public.driver_start_trip(uuid) to authenticated;

-- 4) driver_end_trip : notifie les passagers à la fin du voyage
create or replace function public.driver_end_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  b record;
  v_gross integer;
  v_comm integer;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;

  update public.trips
  set status = 'completed', ended_at = now()
  where id = p_trip_id;

  update public.profiles set current_trip_id = null where id = v_driver;

  for b in
    select bk.*, coalesce(t.distance_km, cp.distance_km, 0) as dist
    from public.bookings bk
    join public.trips t on t.id = bk.trip_id
    left join public.city_prices cp on cp.id = t.city_price_id
    where bk.trip_id = p_trip_id and bk.status = 'confirmed'
  loop
    v_gross := b.seats * v_trip.price_per_seat;
    v_comm := public.compute_commission(b.dist, v_trip.price_per_seat, b.seats);
    if not exists (select 1 from public.payments where booking_id = b.id) then
      insert into public.payments (
        booking_id, trip_id, passenger_id, driver_id,
        amount, commission, driver_earning, method, status, paid_at
      ) values (
        b.id, p_trip_id, b.passenger_id, v_driver,
        v_gross, v_comm, v_gross - v_comm, 'cash', 'paid', now()
      );
    end if;
    update public.bookings set status = 'completed' where id = b.id;

    if b.passenger_id is not null then
      perform public.notify_user(
        b.passenger_id,
        'Voyage terminé ✓',
        'Merci d''avoir voyagé avec Easy Dunya. Code : ' || b.confirmation_code,
        'trip_completed',
        jsonb_build_object('trip_id', p_trip_id, 'booking_id', b.id)
      );
    end if;
  end loop;
end;
$$;
grant execute on function public.driver_end_trip(uuid) to authenticated;
