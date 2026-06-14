-- =====================================================================
-- DIAGNOSTIC + RÉPARATION : cloche lente & push téléphone
-- À exécuter dans Supabase → SQL Editor (tout sélectionner → Run).
-- =====================================================================

-- 1) (RÉPARATION) Activer le temps réel sur notifications + bookings
--    => la cloche devient instantanée.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.notifications'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.bookings';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.driver_positions'; exception when duplicate_object then null; end;
end $$;

-- Réplique complète : permet le filtrage fiable des UPDATE en temps réel
alter table public.notifications replica identity full;
alter table public.bookings      replica identity full;

-- ---------------------------------------------------------------------
-- 2) (DIAGNOSTIC) Tables présentes dans la publication temps réel
--    Tu dois voir : bookings, driver_positions, notifications
-- ---------------------------------------------------------------------
select '➡ tables temps réel' as info, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

-- ---------------------------------------------------------------------
-- 3) (DIAGNOSTIC PUSH) Le déclencheur d'envoi push existe-t-il ?
--    Doit retourner 1 ligne (trg_notifications_push)
-- ---------------------------------------------------------------------
select '➡ trigger push' as info, tgname
from pg_trigger
where tgname = 'trg_notifications_push';

-- ---------------------------------------------------------------------
-- 4) (DIAGNOSTIC PUSH) La config de l'Edge Function est-elle renseignée ?
--    Doit retourner 2 lignes : edge_send_push_url + edge_send_push_token
--    Si VIDE => le push téléphone ne partira jamais (voir setup_push.sql)
-- ---------------------------------------------------------------------
select '➡ config push' as info, key,
       case when key = 'edge_send_push_token'
            then left(value, 6) || '…(masqué)'
            else value end as value
from public.app_config
where key in ('edge_send_push_url', 'edge_send_push_token');

-- ---------------------------------------------------------------------
-- 5) (DIAGNOSTIC PUSH) Des appareils sont-ils abonnés au push ?
--    Si 0 => personne n'a accepté les notifications dans l'app
-- ---------------------------------------------------------------------
select '➡ abonnements push' as info, count(*) as nb_appareils
from public.push_subscriptions;

-- ---------------------------------------------------------------------
-- 6) (TEST) S'envoyer une notification à soi-même (admin connecté).
--    Décommente puis exécute SEULE cette ligne pour tester la cloche :
-- select public.notify_user(auth.uid(), 'Test cloche', 'Doit apparaître tout de suite ✅');
