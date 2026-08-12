-- Compléter le profil admin téléphone (full_name manquant)
update public.profiles
set
  role = 'admin',
  full_name = 'Admin Easy Dunya',
  phone = '20986280',
  driver_status = null,
  must_change_password = false
where id = (
  select id from auth.users
  where email = '20986280@phone.easydunya.app'
  limit 1
);

-- Vérification
select u.email, p.role, p.full_name, p.phone
from auth.users u
join public.profiles p on p.id = u.id
where u.email = '20986280@phone.easydunya.app';
