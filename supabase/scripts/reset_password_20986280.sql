-- =====================================================================
-- Réinitialiser le mot de passe admin (sans menu Dashboard)
-- Projet : prfmqfnaqtmyfyxqjeli
-- Téléphone app : 20986280  →  email : 20986280@phone.easydunya.app
-- Nouveau mot de passe : password1234
-- =====================================================================
-- Exécuter dans Supabase → SQL Editor → Run
-- Puis tester : https://easydunya.netlify.app/login
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

update auth.users
set
  encrypted_password = extensions.crypt('password1234', extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email = '20986280@phone.easydunya.app';

-- Profil admin
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

select
  u.email,
  u.email_confirmed_at is not null as confirme,
  p.role,
  p.phone,
  'Mot de passe défini sur password1234 — testez la connexion' as instruction
from auth.users u
left join public.profiles p on p.id = u.id
where u.email = '20986280@phone.easydunya.app';
