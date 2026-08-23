-- =====================================================================
-- Harmoniser notifications chauffeur = passager (FCM APK, un seul logo)
-- Exécuter dans Supabase → SQL Editor (prfmqfna).
-- Étape A : copier-coller le contenu de supabase/migrations/0035_harmonize_fcm_only.sql
-- Étape B : exécuter ce diagnostic ci-dessous.
-- =====================================================================

-- Comparer passagers vs chauffeurs : qui a FCM vs Web Push ?
select
  p.role,
  count(distinct p.id) as comptes,
  count(distinct dt.user_id) as avec_fcm,
  count(distinct ps.user_id) as avec_web_push
from public.profiles p
left join public.device_tokens dt on dt.user_id = p.id
left join public.push_subscriptions ps on ps.user_id = p.id
where p.role in ('passenger', 'driver')
group by p.role
order by p.role;

-- Chauffeurs SANS token FCM → rouvrir l'APK, se connecter, autoriser notifications
select p.id, p.full_name, p.phone, p.role
from public.profiles p
where p.role = 'driver'
  and not exists (select 1 from public.device_tokens dt where dt.user_id = p.id)
order by p.full_name;

-- Test chauffeur (remplacer USER_ID)
-- select public.notify_user(
--   'USER_ID_CHAUFFEUR'::uuid,
--   'Test chauffeur Easy Dunya',
--   'Meme affichage que passager',
--   'test_driver',
--   '{}'::jsonb
-- );
