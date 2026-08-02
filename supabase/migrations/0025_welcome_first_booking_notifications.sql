-- =====================================================================
-- 0025 — Notifications bienvenue (inscription) + 1ʳᵉ réservation
-- =====================================================================

-- 1) Bienvenue : envoyée quand le token FCM est enregistré (pas à l'insert profil),
--    sinon le push part avant que l'APK ait accepté les notifications.
drop trigger if exists trg_profile_welcome_notify on public.profiles;

create or replace function public.tg_device_token_welcome_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id and n.type = 'welcome'
  ) then
    return new;
  end if;

  perform public.notify_user(
    new.user_id,
    'Merci de faire partie de la famille Easy Dunya',
    null,
    'welcome',
    jsonb_build_object('profile_id', new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_device_token_welcome on public.device_tokens;
create trigger trg_device_token_welcome
  after insert on public.device_tokens
  for each row
  execute function public.tg_device_token_welcome_notify();

-- 2) Première réservation : notification « 100 premiers voyageurs »
--    • uniquement à la 1ʳᵉ réservation du passager
--    • uniquement tant qu'il n'y a pas plus de 100 passagers inscrits (role = passenger)
create or replace function public.tg_booking_notify_passenger_first()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passenger_count integer;
begin
  if new.passenger_id is null then
    return new;
  end if;

  -- Pas la première réservation de ce passager → rien
  if exists (
    select 1
    from public.bookings b
    where b.passenger_id = new.passenger_id
      and b.id <> new.id
  ) then
    return new;
  end if;

  -- Limite : pas plus de 100 passagers inscrits sur la plateforme
  select count(*)
  into v_passenger_count
  from public.profiles
  where role = 'passenger';

  if v_passenger_count > 100 then
    return new;
  end if;

  perform public.notify_user(
    new.passenger_id,
    'Vous faites partie des 100 premiers voyageurs Easy Dunya.',
    null,
    'first_booking',
    jsonb_build_object(
      'booking_id', new.id,
      'trip_id', new.trip_id,
      'passenger_count', v_passenger_count
    )
  );

  return new;
end;
$$;

-- Attacher le trigger bookings seulement si la table existe (évite erreur sur projet incomplet)
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'bookings'
  ) then
    raise notice '0025 : table bookings absente — trigger première réservation ignoré.';
    return;
  end if;

  execute 'drop trigger if exists trg_booking_notify_passenger_first on public.bookings';
  execute '
    create trigger trg_booking_notify_passenger_first
      after insert on public.bookings
      for each row
      execute function public.tg_booking_notify_passenger_first()';
end $$;
