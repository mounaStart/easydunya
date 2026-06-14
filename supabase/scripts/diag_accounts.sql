-- =====================================================================
-- DIAGNOSTIC DES COMPTES RESTANTS
-- Pour comprendre pourquoi 2 comptes subsistent (profiles = 2)
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 1) Tous les profils + email du compte auth associé
select
  p.id,
  p.role,
  p.full_name,
  p.phone,
  p.driver_status,
  u.email,
  u.created_at,
  u.last_sign_in_at
from public.profiles p
left join auth.users u on u.id = p.id
order by p.role, u.created_at;

-- 2) Comptes auth SANS profil (ou profil orphelin)
select u.id, u.email, u.created_at, u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
