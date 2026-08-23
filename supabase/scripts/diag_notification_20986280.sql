-- =====================================================================
-- DIAGNOSTIC COMPLET — notification non reçue (20986280)
-- Projet : prfmqfnaqtmyfyxqjeli
-- Exécuter TOUT ce fichier dans Supabase → SQL Editor → Run
-- =====================================================================

-- ── A) Résumé OK / KO (lire en premier) ───────────────────────────────
with u as (
  select p.id, p.phone, p.role
  from public.profiles p
  where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
     or p.phone = '20986280'
  limit 1
),
tok as (
  select count(*) as n
  from public.device_tokens d
  join u on u.id = d.user_id
),
cfg as (
  select
    count(*) filter (where key = 'edge_send_fcm_url' and coalesce(value, '') <> '') as has_url,
    count(*) filter (where key = 'edge_send_fcm_token' and coalesce(value, '') <> '') as has_tok
  from public.app_config
  where key in ('edge_send_fcm_url', 'edge_send_fcm_token')
),
trg as (
  select count(*) as n
  from pg_trigger
  where tgname = 'trg_notifications_push' and tgenabled = 'O'
),
pgn as (
  select count(*) as n from pg_extension where extname = 'pg_net'
),
last_http as (
  select status_code, left(coalesce(content::text, ''), 120) as body, error_msg
  from net._http_response
  order by created desc
  limit 1
)
select '1. Compte 20986280 trouvé' as test,
  case when exists (select 1 from u) then 'OK' else 'KO — créer le compte dans Auth' end as statut
union all
select '2. Token FCM (APK)',
  case when (select n from tok) > 0 then 'OK (' || (select n from tok)::text || ' token(s))'
       else 'KO — ouvrir APK, se connecter, accepter notifications' end
union all
select '3. edge_send_fcm_url',
  case when (select has_url from cfg) > 0 then 'OK' else 'KO — exécuter setup_notifications_prfmqfna.sql' end
union all
select '4. edge_send_fcm_token (service_role)',
  case when (select has_tok from cfg) > 0 then 'OK' else 'KO — exécuter setup_notifications_prfmqfna.sql' end
union all
select '5. Trigger trg_notifications_push',
  case when (select n from trg) > 0 then 'OK' else 'KO — migration 0022/0031 non appliquée' end
union all
select '6. Extension pg_net',
  case when (select n from pgn) > 0 then 'OK' else 'KO — activer pg_net (Database → Extensions)' end
union all
select '7. Dernier appel HTTP (send-fcm)',
  coalesce(
    (select
      case
        when status_code is null then 'KO — aucun appel (trigger ou config)'
        when status_code = 200 and body like '%"sent":1%' then 'OK — FCM envoyé'
        when status_code = 200 and body like '%"sent":0%' then 'KO — sent:0 (pas de token ou token invalide)'
        when status_code = 401 then 'KO — mauvais service_role dans app_config'
        when status_code = 500 then 'KO — send-fcm erreur (voir logs + FCM_SERVICE_ACCOUNT)'
        else 'KO — HTTP ' || status_code::text || ' ' || coalesce(body, error_msg, '')
      end
     from last_http),
    'KO — aucune réponse pg_net'
  );

-- ── B) Détail compte ──────────────────────────────────────────────────
select 'B compte' as section, p.id as user_id, p.phone, p.role, u.email
from public.profiles p
join auth.users u on u.id = p.id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
   or u.email ilike '%20986280%';

-- ── C) Tokens FCM ─────────────────────────────────────────────────────
select 'C tokens' as section, d.*
from public.device_tokens d
join public.profiles p on p.id = d.user_id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%';

-- ── D) Config push ────────────────────────────────────────────────────
select 'D config' as section, key,
  case when key like '%token%' then left(value, 20) || '…' else value end as valeur
from public.app_config
where key like 'edge_send_%'
order by key;

-- ── E) 5 dernières réponses send-fcm (pg_net) ─────────────────────────
select 'E http' as section,
  id,
  status_code,
  left(coalesce(content::text, ''), 300) as reponse,
  error_msg,
  created
from net._http_response
order by created desc
limit 5;

-- ── F) Dernières notifications insérées ───────────────────────────────
select 'F notifs' as section, n.id, n.title, n.body, n.type, n.created_at
from public.notifications n
join public.profiles p on p.id = n.user_id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
order by n.created_at desc
limit 5;

-- ── G) TEST DIRECT send-fcm (attendre 3 s puis relancer section E) ────
-- Décommente et Run si sections 1-6 sont OK mais toujours pas de notif :
/*
select net.http_post(
  url := (select value from public.app_config where key = 'edge_send_fcm_url'),
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select value from public.app_config where key = 'edge_send_fcm_token')
  ),
  body := jsonb_build_object(
    'user_id', (select id from public.profiles where phone = '20986280' limit 1),
    'title', 'Test direct send-fcm',
    'body', 'Appel HTTP manuel · ' || to_char(now(), 'HH24:MI:SS'),
    'type', 'test_direct',
    'data', jsonb_build_object('tag', 'test_direct', 'url', '/')
  )
) as request_id;
*/

-- =====================================================================
-- CORRECTIONS selon le KO
-- =====================================================================
--
-- KO étape 2 (pas de token) :
--   1. APK à jour (prfmqfna dans Netlify)
--   2. Se connecter avec 20986280
--   3. Paramètres → Notifications Easy Dunya → Autoriser
--   4. Fermer/réouvrir l'app, attendre 10 s, relancer section C
--
-- KO étape 3 ou 4 :
--   → supabase/scripts/setup_notifications_prfmqfna.sql
--   Remplacer <SERVICE_ROLE_KEY> par Settings → API → service_role
--
-- KO HTTP 500 :
--   → Dashboard → Edge Functions → send-fcm → Logs
--   → Edge Functions → Secrets → FCM_SERVICE_ACCOUNT = JSON Firebase complet
--
-- KO sent:0 :
--   → Token expiré : déconnecter/reconnecter dans l'APK
--   → Vérifier google-services.json dans le build APK (GitHub secret GOOGLE_SERVICES_JSON)
--
-- KO HTTP 401 :
--   → edge_send_fcm_token doit être la clé service_role (pas anon)
