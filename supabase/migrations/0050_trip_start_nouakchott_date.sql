-- =====================================================================
-- 0050 — Date prévue = jour civil en Mauritanie (Africa/Nouakchott = GMT).
-- Remplace 0049 si déjà exécuté. À coller dans l'éditeur SQL Supabase.
-- =====================================================================

create or replace function public.expire_overdue_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
  v_count integer := 0;
  b record;
  v_today date := (now() at time zone 'Africa/Nouakchott')::date;
begin
  for v_trip in
    select * from public.trips
    where status = 'scheduled'
      and (depart_at at time zone 'Africa/Nouakchott')::date < v_today
  loop
    for b in
      select id, passenger_id, confirmation_code
      from public.bookings
      where trip_id = v_trip.id
        and status in ('pending', 'confirmed')
        and passenger_id is not null
    loop
      perform public.notify_user(
        b.passenger_id,
        'Voyage expiré',
        'Le trajet prévu n''a pas eu lieu. Code : ' || coalesce(b.confirmation_code, '—'),
        'trip_cancelled',
        jsonb_build_object('trip_id', v_trip.id, 'booking_id', b.id, 'reason', 'overdue')
      );
    end loop;

    update public.trips set status = 'cancelled' where id = v_trip.id;
    update public.profiles
      set current_trip_id = null
      where id = v_trip.driver_id and current_trip_id = v_trip.id;
    update public.bookings
      set status = 'cancelled'
      where trip_id = v_trip.id and status in ('pending', 'confirmed');

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.expire_overdue_trips() to authenticated;

create or replace function public.driver_start_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid := auth.uid();
  v_trip public.trips%rowtype;
  v_locked uuid;
  b record;
  v_today date := (now() at time zone 'Africa/Nouakchott')::date;
begin
  if v_driver is null then raise exception 'not authenticated'; end if;
  perform public.expire_overdue_trips();
  select * into v_trip from public.trips where id = p_trip_id and driver_id = v_driver;
  if not found then raise exception 'trip not found'; end if;
  if v_trip.status <> 'scheduled' then raise exception 'trip not scheduled'; end if;
  if (v_trip.depart_at at time zone 'Africa/Nouakchott')::date < v_today then
    raise exception 'trip departure date has passed';
  end if;

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

grant execute on function public.driver_start_trip(uuid) to authenticated;
