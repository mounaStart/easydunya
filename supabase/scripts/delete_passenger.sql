-- =====================================================================
-- EASY DUNYA — Supprimer un passager par son UUID
-- À exécuter dans Supabase → SQL Editor (rôle postgres).
--
-- Pourquoi un script et pas un simple DELETE :
--   bookings.passenger_id est "on delete set null" + contrainte
--   passenger_or_guest → supprimer l'utilisateur directement échoue
--   si le passager a des réservations sans infos invité.
--   On supprime donc d'abord ses réservations, puis le compte.
--
-- La suppression de auth.users CASCADE vers :
--   profiles, ratings, push_subscriptions, etc.
-- =====================================================================

do $$
declare
  p_uuid uuid := '00000000-0000-0000-0000-000000000000';  -- ⬅️ COLLEZ l'UUID ici
begin
  -- 1) Supprimer les réservations faites par ce passager
  delete from public.bookings where passenger_id = p_uuid;

  -- 2) Supprimer le compte auth (cascade → profiles, ratings, etc.)
  delete from auth.users where id = p_uuid;

  raise notice 'Passager % supprimé.', p_uuid;
end $$;
