-- =====================================================================
-- 0009 — Verrou chauffeur, GPS, annulation + broadcast, paiements
-- =====================================================================

-- Démarrer un voyage (verrouille le chauffeur)
create or replace function public.driver_start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_locked uuid;
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
end;
$$;
grant execute on function public.driver_start_trip(uuid) to authenticated;

-- Terminer un voyage (déverrouille + enregistre les paiements)
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
  end loop;
end;
$$;
grant execute on function public.driver_end_trip(uuid) to authenticated;

-- Mise à jour GPS + déblocage auto à 500 m de la destination
create or replace function public.driver_update_gps(
  p_trip_id uuid, p_lat double precision, p_lng double precision
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_dest record;
  v_dist_km numeric := null;
  v_unlocked boolean := false;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;

  insert into public.driver_positions (trip_id, driver_id, latitude, longitude)
  values (p_trip_id, v_driver, p_lat, p_lng);

  select t.*, c.latitude as dest_lat, c.longitude as dest_lng
  into v_dest
  from public.trips t
  join public.cities c on c.id = t.to_city_id
  where t.id = p_trip_id and t.driver_id = v_driver and t.status = 'in_progress';

  if found then
    v_dist_km := 6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(v_dest.dest_lat))
        * cos(radians(v_dest.dest_lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(v_dest.dest_lat))
      ))
    );
    if v_dist_km <= 0.5 then
      update public.profiles set current_trip_id = null where id = v_driver;
      v_unlocked := true;
    end if;
  end if;

  return jsonb_build_object('unlocked', v_unlocked, 'distance_km', round(coalesce(v_dist_km, 0)::numeric, 2));
end;
$$;
grant execute on function public.driver_update_gps(uuid, double precision, double precision) to authenticated;

-- Annulation voyage + broadcast aux autres chauffeurs (même destination/date)
create or replace function public.cancel_trip_with_broadcast(p_trip_id uuid, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_trip public.trips%rowtype;
  v_count integer := 0;
  v_body text;
  v_role public.user_role;
begin
  select * into v_trip from public.trips where id = p_trip_id;
  if not found then raise exception 'trip not found'; end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'admin' and v_trip.driver_id is distinct from auth.uid() then
    raise exception 'forbidden';
  end if;

  update public.trips set status = 'cancelled' where id = p_trip_id;
  update public.profiles set current_trip_id = null
  where id = v_trip.driver_id and current_trip_id = p_trip_id;

  update public.bookings set status = 'cancelled'
  where trip_id = p_trip_id and status in ('pending', 'confirmed');

  v_body := coalesce(p_reason, 'Un voyage vers votre destination a été annulé. Des passagers peuvent être disponibles.');
  v_count := public.broadcast_drivers_same_destination(
    v_trip.to_city_id,
    (v_trip.depart_at::date),
    'Voyage annulé — passagers disponibles',
    v_body,
    jsonb_build_object('cancelled_trip_id', p_trip_id, 'to_city_id', v_trip.to_city_id)
  );
  return v_count;
end;
$$;
grant execute on function public.cancel_trip_with_broadcast(uuid, text) to authenticated;

-- Chauffeur verrouillé ?
create or replace function public.is_driver_locked(p_driver_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.trips t on t.id = p.current_trip_id
    where p.id = p_driver_id and t.status = 'in_progress'
  );
$$;
grant execute on function public.is_driver_locked(uuid) to authenticated;
