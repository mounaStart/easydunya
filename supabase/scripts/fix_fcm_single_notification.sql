-- =====================================================================
-- Une seule notif FCM par type (tag welcome, logo Easy Dunya)
-- Exécuter dans Supabase → SQL Editor (prfmqfna).
-- =====================================================================

-- 1) Passer le type au send-fcm (pour tag Android = remplace au lieu de dupliquer)
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
begin
  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   new.title,
    'body',    new.body,
    'type',    new.type,
    'data',    coalesce(new.data, '{}'::jsonb) || jsonb_build_object('type', coalesce(new.type, ''))
  );

  select value into v_url   from public.app_config where key = 'edge_send_push_url';
  select value into v_token from public.app_config where key = 'edge_send_push_token';
  if v_url is not null then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_token, '')
      ),
      body    := v_payload
    );
  end if;

  select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
  select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
  if v_fcm_url is not null then
    perform net.http_post(
      url     := v_fcm_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
      ),
      body    := v_payload
    );
  end if;

  return new;
end;
$$;

-- 2) Une seule bienvenue (token FCM uniquement)
drop trigger if exists trg_profile_welcome_notify on public.profiles;

-- 3) Nettoyer doublons existants
delete from public.notifications n
using public.notifications keep
where n.type = 'welcome'
  and keep.type = 'welcome'
  and n.user_id = keep.user_id
  and n.id <> keep.id
  and keep.created_at = (
    select min(created_at)
    from public.notifications w
    where w.user_id = n.user_id and w.type = 'welcome'
  );

select 'OK — trigger push avec type + bienvenue unique' as status;
