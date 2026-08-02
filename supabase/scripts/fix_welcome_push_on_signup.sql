-- =====================================================================
-- CORRECTION : bienvenue à l'inscription + push sur le téléphone
--
-- Problème : la notif « bienvenue » partait à la création du profil,
-- AVANT que l'APK enregistre le token FCM (après connexion + permission).
-- Résultat : cloche parfois OK, barre téléphone jamais.
--
-- Solution : envoyer la bienvenue quand le 1er token FCM est enregistré.
-- À exécuter dans Supabase → SQL Editor (prfmqfna) → Run.
-- =====================================================================

-- 1) Retirer l'ancien trigger (trop tôt pour le push)
drop trigger if exists trg_profile_welcome_notify on public.profiles;

-- 2) Bienvenue au 1er token FCM (après connexion + permission notifications)
create or replace function public.tg_device_token_welcome_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.notifications n
    where n.user_id = new.user_id
      and n.type = 'welcome'
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

-- 3) Migration 0025 : 100 premiers voyageurs (1ʳᵉ réservation)
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

  if exists (
    select 1
    from public.bookings b
    where b.passenger_id = new.passenger_id
      and b.id <> new.id
  ) then
    return new;
  end if;

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

drop trigger if exists trg_booking_notify_passenger_first on public.bookings;
create trigger trg_booking_notify_passenger_first
  after insert on public.bookings
  for each row
  execute function public.tg_booking_notify_passenger_first();

-- 4) Vérifications
select 'triggers actifs' as info, tgname
from pg_trigger
where tgname in (
  'trg_device_token_welcome',
  'trg_booking_notify_passenger_first',
  'trg_notifications_push'
)
order by tgname;

select 'passagers inscrits' as info, count(*) as nb
from public.profiles
where role = 'passenger';
