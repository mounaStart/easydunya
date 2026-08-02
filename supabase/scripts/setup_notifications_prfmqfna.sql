-- =====================================================================
-- NOTIFICATIONS TÉLÉPHONE (FCM) + WEB PUSH — projet prfmqfnaqtmyfyxqjeli
-- À exécuter dans Supabase → SQL Editor APRÈS :
--   1. migrations 0015 + 0022 appliquées
--   2. Edge Functions send-push et send-fcm déployées
--   3. secrets Supabase : FCM_SERVICE_ACCOUNT, VAPID_* (voir docs)
--
-- Remplacez <SERVICE_ROLE_KEY> par Settings → API → service_role (secret)
-- =====================================================================

insert into public.app_config (key, value) values
  (
    'edge_send_push_url',
    'https://prfmqfnaqtmyfyxqjeli.supabase.co/functions/v1/send-push'
  ),
  ('edge_send_push_token', '<SERVICE_ROLE_KEY>'),
  (
    'edge_send_fcm_url',
    'https://prfmqfnaqtmyfyxqjeli.supabase.co/functions/v1/send-fcm'
  ),
  ('edge_send_fcm_token', '<SERVICE_ROLE_KEY>')
on conflict (key) do update set value = excluded.value;

-- Realtime cloche (optionnel mais recommandé)
alter publication supabase_realtime add table public.notifications;
alter table public.notifications replica identity full;

-- Vérification
select key,
       case when key like '%token%' then left(value, 12) || '…' else value end as value
from public.app_config
where key like 'edge_send_%'
order by key;

-- Test manuel (remplacez USER_ID) :
-- select public.notify_user(
--   'USER_ID'::uuid,
--   'Test Easy Dunya',
--   'Notification sur le téléphone 📱',
--   'test',
--   '{"tag":"test"}'::jsonb
-- );
