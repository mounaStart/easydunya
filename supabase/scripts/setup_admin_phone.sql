-- =====================================================================
-- Configurer / réparer le compte ADMIN avec connexion par téléphone
-- Téléphone utilisé : +22230000001  →  email auth : 22230000001@phone.easydunya.app
--
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 1) Diagnostic : voir les comptes existants
select id, email, email_confirmed_at, created_at
from auth.users
where email ilike '%30000001%'
   or email ilike '%admin%'
   or email ilike '%phone.easydunya%';

select id, role, full_name, phone, driver_status
from public.profiles
where role = 'admin'
   or phone ilike '%30000001%';

-- =====================================================================
-- 2) Si un compte admin existe déjà (ex: admin@easydunya.mr) → le migrer
-- =====================================================================
update auth.users
set
  email = '22230000001@phone.easydunya.app',
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'phone', '22230000001',
         'role', 'admin',
         'full_name', 'Admin Easy Dunya'
       )
where email in (
  'admin@easydunya.mr',
  'admin@admin.easydunya.app'
);

-- Profil admin aligné
insert into public.profiles (id, role, full_name, phone, driver_status, must_change_password)
select
  u.id,
  'admin',
  'Admin Easy Dunya',
  '+22230000001',
  null,
  false
from auth.users u
where u.email = '22230000001@phone.easydunya.app'
on conflict (id) do update set
  role = 'admin',
  full_name = excluded.full_name,
  phone = excluded.phone,
  driver_status = null,
  must_change_password = false;

-- =====================================================================
-- 3) Si AUCUN compte n'existe après l'étape 2 :
--    Créez-le dans Supabase → Authentication → Users → Add user
--      Email    : 22230000001@phone.easydunya.app
--      Password : (votre mot de passe admin)
--      ✓ Auto Confirm User
--    Puis relancez uniquement le bloc INSERT profiles ci-dessus.
-- =====================================================================

-- 4) Vérification finale
select u.id, u.email, u.email_confirmed_at, p.role, p.phone, p.full_name
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = '22230000001@phone.easydunya.app';
