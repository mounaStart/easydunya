-- =============================================================
-- DIAGNOSTIC NOTIFICATIONS FCM NATIF (APK Capacitor)
-- Exécute chaque bloc dans le SQL Editor Supabase.
-- =============================================================

-- 1) Quel système est actif ?
select 'push_subscriptions (navigateur/web)' as systeme, count(*) as total
from public.push_subscriptions
union all
select 'device_tokens (APK natif FCM)', count(*)
from public.device_tokens;

-- ✅ APK Capacitor : device_tokens = 1+, push_subscriptions = 0
-- ❌ Si seulement push_subscriptions > 0 → l'app utilise encore le web-push

-- 2) Détail des tokens natifs (doit y en avoir au moins 1)
select user_id, left(token, 40) as token_debut, platform, created_at
from public.device_tokens
order by created_at desc;

-- 3) Config serveur FCM (doit avoir 2 lignes)
select key, left(value, 60) as valeur_debut
from public.app_config
where key like 'edge_send_fcm%' or key like 'edge_send_push%'
order by key;

-- edge_send_fcm_url   → https://<ref>.supabase.co/functions/v1/send-fcm
-- edge_send_fcm_token → eyJ... (service role key)

-- 4) Dernières notifications créées
select id, user_id, title, body, created_at
from public.notifications
order by created_at desc
limit 5;

-- 5) Table device_tokens existe ?
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'device_tokens'
) as table_device_tokens_existe;

-- Si FALSE → exécuter la migration 0022_device_tokens_fcm.sql
