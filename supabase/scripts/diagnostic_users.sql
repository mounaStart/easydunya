-- =====================================================================
-- DIAGNOSTIC : voir l'état des comptes
-- =====================================================================

-- 1) Tous les utilisateurs avec leur rôle et statut chauffeur
select
  p.role,
  p.driver_status,
  p.full_name,
  p.phone,
  u.email,
  p.created_at
from public.profiles p
left join auth.users u on u.id = p.id
order by p.created_at desc;

-- 2) Nombre de chauffeurs par statut
select
  driver_status,
  count(*) as nombre
from public.profiles
where role = 'driver'
group by driver_status;

-- 3) Si vous voulez convertir un utilisateur existant en chauffeur pending
--    pour tester la validation admin, dé-commentez et remplacez l'email :
--
-- update public.profiles
--    set role = 'driver',
--        driver_status = 'pending'
--  where id = (select id from auth.users where email = 'EMAIL_A_REMPLACER');
