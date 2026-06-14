-- =====================================================================
-- driver_end_trip : autoriser AUSSI l'administrateur à terminer un voyage
-- (le chauffeur reste limité à ses propres voyages ; côté UI il ne voit
--  le bouton qu'à proximité de la destination — l'admin l'a toujours).
-- =====================================================================
create or replace function public.driver_end_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_caller uuid := auth.uid();
  v_is_admin boolean := public.current_role_safe() = 'admin';
  v_trip public.trips%rowtype;
  v_driver uuid;
  b record;
  v_gross integer;
  v_comm integer;
begin
  if v_caller is null then raise exception 'not authenticated'; end if;

  -- Admin : n'importe quel voyage ; chauffeur : uniquement les siens
  if v_is_admin then
    select * into v_trip from public.trips where id = p_trip_id;
  else
    select * into v_trip from public.trips where id = p_trip_id and driver_id = v_caller;
  end if;
  if not found then raise exception 'trip not found'; end if;

  v_driver := v_trip.driver_id;

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
