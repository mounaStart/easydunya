-- =====================================================================
-- Brancher le déclencheur Web Push sur l'Edge Function `send-push`.
-- À exécuter dans Supabase → SQL Editor APRÈS :
--   1. avoir appliqué la migration 0015_web_push.sql
--   2. avoir déployé l'Edge Function send-push
--
-- Remplacez :
--   <PROJECT_REF>      = la référence du projet (ex: abcdxyz)
--   <SERVICE_ROLE_KEY> = Project Settings → API → service_role (secret)
-- =====================================================================

insert into public.app_config (key, value) values
  ('edge_send_push_url',   'https://<PROJECT_REF>.supabase.co/functions/v1/send-push'),
  ('edge_send_push_token', '<SERVICE_ROLE_KEY>')
on conflict (key) do update set value = excluded.value;

-- Vérification
select key,
       case when key = 'edge_send_push_token'
            then left(value, 8) || '…(masqué)'
            else value end as value
from public.app_config
order by key;

-- Test manuel : s'envoyer une notif (déclenche le push si un appareil est abonné)
-- select public.notify_user(auth.uid(), 'Test push', 'Si tu vois ça dans la barre, c''est bon ✅');
