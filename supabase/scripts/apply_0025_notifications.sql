-- =====================================================================
-- Easy Dunya — Appliquer la migration 0025 (notifications)
-- Coller TOUT ce fichier dans Supabase → SQL Editor → Run
-- =====================================================================
-- ERREUR « relation public.bookings does not exist » ?
--   → Ce projet n'a pas encore le schéma Easy Dunya complet.
--   → Utilisez le projet PROD (pqljcsnsyvacobdmpqgn) OU exécutez d'abord :
--       0001_init.sql  puis  0008_easydunya_v2.sql  (minimum)
-- =====================================================================

-- 0) Vérifications
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'profiles'
  ) then
    raise exception 'Table public.profiles manquante. Exécutez 0001_init.sql d''abord.';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'notify_user'
  ) then
    raise exception 'Fonction notify_user manquante. Exécutez 0008_easydunya_v2.sql d''abord.';
  end if;
end $$;

-- 1) Bienvenue : au 1er token FCM (voir fix_welcome_push_on_signup.sql)
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

-- 2) Première réservation (seulement si la table bookings existe)
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'bookings'
  ) then
    raise notice '⚠ Table bookings absente — notification « 100 premiers voyageurs » NON installée.';
    raise notice '   Appliquez 0001_init.sql sur ce projet, puis relancez ce script.';
    return;
  end if;

  execute $fn$
    create or replace function public.tg_booking_notify_passenger_first()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
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
    $body$;
  $fn$;

  execute 'drop trigger if exists trg_booking_notify_passenger_first on public.bookings';
  execute '
    create trigger trg_booking_notify_passenger_first
      after insert on public.bookings
      for each row
      execute function public.tg_booking_notify_passenger_first()';

  raise notice '✓ Notification « 100 premiers voyageurs » installée.';
end $$;

select 'Migration 0025 : bienvenue installée ✓' as status;
