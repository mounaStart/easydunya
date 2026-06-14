-- =============================================================
-- RESET PUSH SUBSCRIPTIONS
-- Objectif : repartir d'une table rase pour identifier la source
-- des notifications (navigateur Samsung Internet vs APK installée).
-- =============================================================

-- 1) Voir ce qui existe AVANT suppression (diagnostic)
--    L'endpoint indique la source :
--    - contient "mozilla"/"wns"/"push.samsung" -> navigateur (Samsung Internet/Firefox/Edge)
--    - contient "fcm.googleapis.com" / "android.googleapis.com" -> Chrome / APK (FCM)
select
  id,
  user_id,
  left(endpoint, 60) as endpoint_debut,
  case
    when endpoint ilike '%fcm.googleapis.com%' or endpoint ilike '%android.googleapis.com%' then 'FCM (Chrome/APK)'
    when endpoint ilike '%push.services.mozilla%' then 'Firefox'
    when endpoint ilike '%notify.windows.com%' then 'Edge/WNS'
    when endpoint ilike '%samsung%' then 'Samsung Internet'
    else 'Autre/navigateur'
  end as source,
  created_at
from public.push_subscriptions
order by created_at desc;

-- 2) TOUT supprimer (table rase)
--    Décommente la ligne suivante pour exécuter la suppression :
-- delete from public.push_subscriptions;

-- 3) (Optionnel) Supprimer UNIQUEMENT les abonnements navigateur,
--    en gardant ceux de l'APK (FCM) :
-- delete from public.push_subscriptions
-- where endpoint not ilike '%fcm.googleapis.com%'
--   and endpoint not ilike '%android.googleapis.com%';

-- 4) Vérifier qu'il ne reste rien (ou seulement l'APK)
-- select count(*) as restants from public.push_subscriptions;
