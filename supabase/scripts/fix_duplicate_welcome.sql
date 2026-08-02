-- =====================================================================
-- CORRECTION : une seule notif bienvenue + suppression des doublons
-- Exécuter dans Supabase → SQL Editor (prfmqfna).
-- =====================================================================

-- 1) Un seul trigger bienvenue (sur token FCM, pas sur profil)
drop trigger if exists trg_profile_welcome_notify on public.profiles;

-- 2) Renforcer l'idempotence côté base
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

-- 3) Nettoyer les doublons déjà créés (garde la plus ancienne)
delete from public.notifications n
using public.notifications keep
where n.type = 'welcome'
  and keep.type = 'welcome'
  and n.user_id = keep.user_id
  and n.id <> keep.id
  and keep.created_at = (
    select min(created_at)
    from public.notifications w
    where w.user_id = n.user_id
      and w.type = 'welcome'
  );

select 'welcome restantes' as info, user_id, count(*) as nb
from public.notifications
where type = 'welcome'
group by user_id
having count(*) > 1;

select 'triggers actifs' as info, tgname
from pg_trigger
where tgname in ('trg_profile_welcome_notify', 'trg_device_token_welcome');
