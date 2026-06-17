-- =============================================================
-- TEST ENVOI FCM — diagnostic complet
-- Exécute bloc par bloc dans le SQL Editor Supabase.
-- =============================================================

-- A) Tokens enregistrés (tu as 2 ✓)
select user_id, left(token, 50) as token, platform, created_at
from public.device_tokens
order by created_at desc;

-- B) Config FCM obligatoire (doit retourner 2 lignes)
select key,
  case
    when key like '%token%' then left(value, 20) || '...'
    else value
  end as valeur
from public.app_config
where key in (
  'edge_send_fcm_url',
  'edge_send_fcm_token',
  'edge_send_push_url',
  'edge_send_push_token'
)
order by key;

-- ❌ Si edge_send_fcm_url ou edge_send_fcm_token manquent → le trigger n'appelle PAS send-fcm

-- C) Dernières notifications insérées (quand tu fais une réservation)
select id, user_id, title, body, created_at
from public.notifications
order by created_at desc
limit 10;

-- ❌ Si vide après une réservation → le problème est AVANT l'envoi (trigger booking)

-- D) TEST MANUEL : insérer une notification de test
-- ⚠️ Remplace USER_ID par le user_id du chauffeur/passager à tester
--    (copie-le depuis la requête A ci-dessus)

/*
insert into public.notifications (user_id, title, body, data)
values (
  'COLLER_USER_ID_ICI',
  'Test Easy Dunya',
  'Si tu vois ceci, FCM fonctionne !',
  '{"tag":"test"}'::jsonb
);
*/

-- Après l'insert ci-dessus :
-- 1. Vérifie les logs Supabase → Edge Functions → send-fcm
-- 2. Le téléphone doit recevoir la notif en ~5 secondes

-- E) Vérifier que le trigger push existe
select tgname, tgenabled
from pg_trigger
where tgname = 'trg_notifications_push';

-- F) Vérifier pg_net (requis pour appeler l'Edge Function)
select extname from pg_extension where extname = 'pg_net';
