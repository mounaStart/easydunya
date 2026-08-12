-- =====================================================================
-- Diagnostic connexion — projet prfmqfnaqtmyfyxqjeli
-- Exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 1) Quels comptes existent pour 20986280 ?
select
  u.id,
  u.email,
  u.email_confirmed_at is not null as email_confirme,
  u.last_sign_in_at,
  p.role,
  p.full_name,
  p.phone
from auth.users u
left join public.profiles p on p.id = u.id
where u.email ilike '%20986280%'
   or p.phone ilike '%20986280%'
   or u.email ilike '%86280%';

-- 2) Email attendu par l'app pour le téléphone 20986280 :
select '20986280@phone.easydunya.app' as email_attendu_par_l_app;

-- 3) Tous les utilisateurs (aperçu)
select u.email, p.role, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc
limit 20;

-- =====================================================================
-- APRÈS diagnostic : le mot de passe ne se change PAS en SQL.
-- Dashboard → Authentication → Users :
--   • Si aucun user 20986280@phone.easydunya.app → Add user
--   • Sinon → clic sur l'utilisateur → Reset password / Update user
--       Email    : 20986280@phone.easydunya.app
--       Password : password1234  (ou votre choix)
--       ✓ Auto Confirm User
-- Puis exécuter setup_mounastart_admin.sql
-- =====================================================================
