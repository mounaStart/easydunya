-- =====================================================================
-- 0030 — UTF-8 notifications + driver_end_trip (encodage corrompu en prod)
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

-- Nettoyage des lignes déjà enregistrées avec mauvais encodage
update public.notifications
set title = 'Voyage terminé ✓'
where type = 'trip_completed'
   or title like '%Voyage termin%Ã%'
   or title like '%âœ%';

update public.notifications
set body = 'Merci d''avoir voyagé avec Easy Dunya. Code : ' ||
  coalesce(
    nullif(substring(body from 'Code : ([A-Z0-9]+)'), ''),
    ''
  )
where type = 'trip_completed'
  and (body like '%voyag%Ã%' or body like '%â%');

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
set title = 'Mot de passe réinitialisé ✓'
where title like '%Mot de passe r%Ã%initialis%';

-- Éviter double push APK (FCM + Web Push) : FCM prioritaire si token natif présent
create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url      text;
  v_token    text;
  v_fcm_url  text;
  v_fcm_tok  text;
  v_payload  jsonb;
  v_has_fcm  boolean;
begin
  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   new.title,
    'body',    new.body,
    'type',    new.type,
    'data',    coalesce(new.data, '{}'::jsonb) || jsonb_build_object('type', coalesce(new.type, ''))
  );

  select exists(
    select 1 from public.device_tokens where user_id = new.user_id
  ) into v_has_fcm;

  if v_has_fcm then
    select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
    select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
    if v_fcm_url is not null then
      perform net.http_post(
        url     := v_fcm_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json; charset=utf-8',
          'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
        ),
        body    := v_payload
      );
    end if;
  else
    select value into v_url   from public.app_config where key = 'edge_send_push_url';
    select value into v_token from public.app_config where key = 'edge_send_push_token';
    if v_url is not null then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json; charset=utf-8',
          'Authorization', 'Bearer ' || coalesce(v_token, '')
        ),
        body    := v_payload
      );
    end if;
  end if;

  return new;
end;
$$;
