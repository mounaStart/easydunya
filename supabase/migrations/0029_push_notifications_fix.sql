-- =====================================================================
-- 0029 — Fiabiliser les notifications push (FCM)
--   • Passer le type au send-fcm (tag Android correct)
--   • Même payload pour send-push et send-fcm
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

-- Realtime cloche (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when others then
  null;
end $$;

alter table public.notifications replica identity full;
