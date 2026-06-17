-- =============================================================
-- Vérifier si le trigger a bien appelé send-fcm (pg_net)
-- Exécute après un insert test dans notifications.
-- =============================================================

-- Réponses HTTP récentes de pg_net
select
  id,
  status_code,
  left(content::text, 200) as reponse,
  error_msg,
  created
from net._http_response
order by created desc
limit 10;

-- Si status_code = 200 et reponse contient "sent":1 → Firebase OK
-- Si status_code = 500 → erreur send-fcm (voir Edge Function logs)
-- Si vide → pg_net pas actif ou trigger pas déclenché
