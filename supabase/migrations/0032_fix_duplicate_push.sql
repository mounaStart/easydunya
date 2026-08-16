-- =====================================================================
-- 0032 — Une seule notification push par événement (APK)
--   • FCM natif OU Web Push, jamais les deux
--   • Supprime les abonnements Web Push des comptes avec token FCM
-- =====================================================================

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
  else
    select value into v_url   from public.app_config where key = 'edge_send_push_url';
    select value into v_token from public.app_config where key = 'edge_send_push_token';
    if v_url is not null then
      begin
        perform net.http_post(
          url     := v_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || coalesce(v_token, '')
          ),
          body    := v_payload
        );
      exception when others then
        raise warning 'send-push failed for user %: %', new.user_id, sqlerrm;
      end;
    end if;
  end if;

  return new;
end;
$$;

-- APK : ne garder que FCM (évite « Easy Dunya » générique via le service worker Web Push)
delete from public.push_subscriptions ps
where exists (
  select 1 from public.device_tokens dt where dt.user_id = ps.user_id
);
