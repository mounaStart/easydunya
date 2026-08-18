-- =====================================================================
-- 0033 — Désactiver Web Push (navigateur / service worker)
-- Notifications barre téléphone : FCM natif (APK) uniquement.
-- La cloche in-app (Realtime) reste active sur le site web.
-- =====================================================================

create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
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

  select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
  select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
  if v_fcm_url is not null then
    begin
      perform net.http_post(
        url     := v_fcm_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
        ),
        body    := v_payload
      );
    exception when others then
      raise warning 'send-fcm failed for user %: %', new.user_id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

delete from public.push_subscriptions;
