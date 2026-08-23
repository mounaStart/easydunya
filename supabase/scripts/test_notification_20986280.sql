-- =====================================================================
-- TEST NOTIFICATIONS — téléphone 20986280
-- Projet : prfmqfnaqtmyfyxqjeli
--
-- Où exécuter : Supabase Dashboard → SQL Editor → New query → Run
--
-- Prérequis :
--   • APK installée + notifications activées sur le téléphone
--   • Compte connecté avec 20986280 (email : 20986280@phone.easydunya.app)
--   • app_config : edge_send_fcm_url + edge_send_fcm_token (voir setup_notifications_prfmqfna.sql)
--   • Edge Function send-fcm déployée + secret FCM_SERVICE_ACCOUNT
-- =====================================================================

-- ── 1) Vérifier le compte ─────────────────────────────────────────────
select
  p.id          as user_id,
  p.phone,
  p.role,
  p.full_name,
  u.email
from public.profiles p
join auth.users u on u.id = p.id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
   or u.email ilike '%20986280%';

-- ── 2) Token FCM enregistré ? (obligatoire pour l'APK) ─────────────────
select
  d.user_id,
  p.phone,
  d.platform,
  left(d.token, 40) || '…' as token_debut,
  d.created_at
from public.device_tokens d
join public.profiles p on p.id = d.user_id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
   or p.phone = '20986280'
order by d.created_at desc;

-- ❌ 0 ligne → ouvrir l'APK, se connecter, accepter les notifications, puis relancer.

-- ── 3) Config FCM ───────────────────────────────────────────────────────
select key,
  case when key like '%token%' then left(value, 16) || '…' else value end as valeur
from public.app_config
where key in ('edge_send_fcm_url', 'edge_send_fcm_token');

-- ── 4) ENVOYER une notification de test (exécuter ce bloc seul) ────────
do $$
declare
  v_user uuid;
begin
  select p.id into v_user
  from public.profiles p
  where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
     or p.phone = '20986280'
  limit 1;

  if v_user is null then
    raise exception 'Aucun compte trouvé pour le numéro 20986280';
  end if;

  perform public.notify_user(
    v_user,
    'Test Easy Dunya',
    'Notification test Supabase · ' || to_char(now(), 'HH24:MI:SS'),
    'test_manual',
    jsonb_build_object('tag', 'test_manual', 'url', '/')
  );

  raise notice 'OK — notification insérée pour user_id % (FCM dans ~5 s)', v_user;
end;
$$;

-- Variante manuelle (même effet) :
/*
select public.notify_user(
  (select p.id from public.profiles p where p.phone = '20986280' limit 1),
  'Test Easy Dunya',
  'Notification test depuis Supabase',
  'test_manual',
  '{"tag":"test_manual","url":"/"}'::jsonb
);
*/

-- ── 5) Vérifier la réponse send-fcm (CRUCIAL si pas de notif) ───────────
-- Attendre 5 secondes après l'étape 4, puis exécuter :
select
  status_code,
  left(coalesce(content::text, ''), 250) as reponse_fcm,
  error_msg,
  created
from net._http_response
order by created desc
limit 3;

-- Interprétation :
--   status_code 200 + "sent":1  → FCM OK (vérifier téléphone / mode silencieux)
--   status_code 200 + "sent":0  → pas de token FCM valide pour ce compte
--   status_code 401             → mauvaise clé dans edge_send_fcm_token
--   status_code 500             → secret FCM_SERVICE_ACCOUNT manquant/invalide
--   (vide)                      → config FCM absente ou trigger inactif
--
-- Diagnostic complet : supabase/scripts/diag_notification_20986280.sql

-- ── 6) Historique notifications ───────────────────────────────────────
select
  n.id,
  n.title,
  n.body,
  n.type,
  n.created_at
from public.notifications n
join public.profiles p on p.id = n.user_id
where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
order by n.created_at desc
limit 5;

-- Logs Edge Function : Dashboard → Edge Functions → send-fcm → Logs
-- Réponse attendue : {"sent":1,...}

-- ── 7) Test « réservation » (simule une vraie notif) ───────────────────
/*
select public.notify_user(
  (
    select p.id from public.profiles p
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%20986280%'
    limit 1
  ),
  'Demande envoyée au chauffeur',
  'Code TEST01 · en attente de confirmation',
  'booking_pending',
  jsonb_build_object('tag', 'easydunya_booking_pending', 'url', '/bookings')
);
*/
