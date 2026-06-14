-- =====================================================================
-- RESTAURER LE COMPTE ADMIN écrasé en "passager"
-- À exécuter dans Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ÉTAPE 1 : Retrouver le compte admin (par son numéro de téléphone).
--   Remplace 20986280 par le numéro de TON admin (chiffres uniquement).
-- ---------------------------------------------------------------------
select u.id, u.email, u.created_at, p.role, p.full_name, p.phone
from auth.users u
left join public.profiles p on p.id = u.id
where u.email ilike '%20986280%'
   or p.phone ilike '%20986280%'
order by u.created_at;

-- ---------------------------------------------------------------------
-- ÉTAPE 2 : Remettre ce compte en ADMIN.
--   Remplace 20986280 par le bon numéro (même que ci-dessus).
--   Le numéro est normalisé (avec ou sans +, espaces : peu importe).
-- ---------------------------------------------------------------------
update public.profiles p
set role = 'admin',
    driver_status = null,
    must_change_password = false
from auth.users u
where p.id = u.id
  and regexp_replace(coalesce(u.email, ''), '\D', '', 'g') like '20986280%';

-- ---------------------------------------------------------------------
-- ÉTAPE 3 : Vérifier
-- ---------------------------------------------------------------------
select u.email, p.role, p.full_name, p.phone
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';
