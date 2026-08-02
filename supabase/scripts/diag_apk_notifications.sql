-- =====================================================================
-- DIAGNOSTIC : SQL OK mais pas de notif depuis l'APK ?
-- Exécuter dans Supabase → SQL Editor (prfmqfna).
-- =====================================================================

-- 1) Triggers réservations (obligatoires pour notifs depuis l'APK)
select '1. triggers réservation' as etape, tgname
from pg_trigger
where tgname in (
  'trg_booking_notify_driver',
  'trg_booking_notify_status',
  'trg_booking_notify_passenger_pending',
  'trg_notifications_push'
)
order by tgname;

-- 2) Config FCM (obligatoire pour la barre Android)
select '2. config FCM' as etape, key,
       case when key like '%token%' then left(value, 8) || '…' else value end as value
from public.app_config
where key in ('edge_send_fcm_url', 'edge_send_fcm_token');

-- 3) Tokens APK (pas push_subscriptions — c'est pour le navigateur)
select '3. tokens FCM APK' as etape, p.phone, p.role, count(d.id) as nb_tokens
from public.profiles p
left join public.device_tokens d on d.user_id = p.id
group by p.id, p.phone, p.role
order by nb_tokens desc, p.phone;

-- 4) Dernières notifs créées par l'app (pas le test SQL manuel)
select '4. dernières notifs app' as etape,
       p.phone,
       n.type,
       n.title,
       n.created_at
from public.notifications n
join public.profiles p on p.id = n.user_id
where n.type in (
  'booking_new',
  'booking_pending',
  'booking_confirmed',
  'booking_rejected',
  'booking_cancelled_by_passenger'
)
order by n.created_at desc
limit 15;

-- 5) Dernières réponses send-fcm (doit être sent:1)
select '5. derniers push FCM' as etape,
       status_code,
       left(content::text, 200) as reponse
from net._http_response
order by created desc
limit 5;

-- 6) Qui reçoit quoi ? (remplace le numéro)
-- Passager réserve → notif CHAUFFEUR (booking_new) + passager (booking_pending)
-- Chauffeur confirme → notif PASSAGER (booking_confirmed)
select '6. compte test' as etape, id, phone, role, full_name
from public.profiles
where phone = '20986280';  -- ← ton numéro
