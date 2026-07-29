-- =====================================================================
-- Easy Dunya — compte ADMIN par téléphone (projet prfmqfnaqtmyfyxqjeli)
-- =====================================================================
-- AVANT d'exécuter ce script :
-- 1) Dashboard → Authentication → Sign In / Providers → Email → ACTIVER
-- 2) Authentication → Users → Add user (si besoin) :
--      Email    : 20986280@phone.easydunya.app
--      Password : password1234  (ou le vôtre)
--      ✓ Auto Confirm User
-- 3) Puis exécutez ce script dans SQL Editor
-- =====================================================================

-- Diagnostic
select u.id, u.email, p.role, p.full_name, p.phone
from auth.users u
left join public.profiles p on p.id = u.id
where u.email ilike '%20986280%'
   or p.phone ilike '%20986280%';

-- Migrer un ancien compte Gmail vers connexion par téléphone
update auth.users
set
  email = '20986280@phone.easydunya.app',
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'phone', '20986280',
         'role', 'admin',
         'full_name', 'Admin Easy Dunya'
       )
where email in (
  'admin.arjehen@gmail.com',
  'admin.easydunya@gmail.com',
  '22220986280@phone.easydunya.app'
);

update auth.identities
set
  identity_data = jsonb_set(
    coalesce(identity_data, '{}'::jsonb),
    '{email}',
    '"20986280@phone.easydunya.app"'::jsonb
  ),
  updated_at = now()
where user_id = (select id from auth.users where email = '20986280@phone.easydunya.app')
  and provider = 'email';

insert into public.profiles (id, role, full_name, phone, driver_status, must_change_password)
select
  u.id,
  'admin',
  'Admin Easy Dunya',
  '20986280',
  null,
  false
from auth.users u
where u.email = '20986280@phone.easydunya.app'
on conflict (id) do update set
  role = 'admin',
  full_name = excluded.full_name,
  phone = excluded.phone,
  driver_status = null,
  must_change_password = false;

-- Vérification
select u.id, u.email, p.role, p.full_name, p.phone
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = '20986280@phone.easydunya.app';
