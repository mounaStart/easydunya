-- =====================================================================
-- DIAGNOSTIC : pourquoi le chauffeur ne reçoit pas le push "nouvelle demande"
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================================

-- 1) Le trigger qui notifie le chauffeur existe-t-il ? (migration 0018)
--    Doit retourner 1 ligne : trg_booking_notify_driver
select '1. trigger notif chauffeur' as etape, tgname
from pg_trigger
where tgname = 'trg_booking_notify_driver';

-- 2) Le chauffeur a-t-il un appareil abonné au push ?
--    Remplace <DRIVER_PHONE> par le numéro du chauffeur (ex: 22334455)
--    Si nb_appareils = 0 => le chauffeur n'a PAS cliqué
--    "Activer les notifications" sur son téléphone => aucun push possible.
select '2. abonnements push chauffeur' as etape,
       p.full_name, p.phone, count(s.id) as nb_appareils
from public.profiles p
left join public.push_subscriptions s on s.user_id = p.id
where p.role = 'driver'
group by p.id, p.full_name, p.phone
order by nb_appareils;

-- 3) Dernières notifications "nouvelle demande" créées pour les chauffeurs
--    Si présentes => la cloche marche, le souci est l'abonnement push (étape 2)
select '3. notifs booking_new' as etape,
       n.user_id, n.title, n.body, n.created_at
from public.notifications n
where n.type = 'booking_new'
order by n.created_at desc
limit 10;
