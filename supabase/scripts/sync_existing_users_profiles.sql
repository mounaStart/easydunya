-- =====================================================================
-- Recréer les profils pour TOUS les utilisateurs auth existants
-- (après reset_public + bootstrap, si des users existaient déjà)
-- Projet : prfmqfnaqtmyfyxqjeli
-- =====================================================================

insert into public.profiles (id, role, full_name, phone, driver_status)
select
  u.id,
  case
    when u.raw_user_meta_data->>'role' in ('passenger', 'driver', 'admin')
      then (u.raw_user_meta_data->>'role')::public.user_role
    else 'passenger'::public.user_role
  end,
  coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'phone', null),
  case
    when u.raw_user_meta_data->>'role' = 'driver'
      then 'pending'::public.driver_status
    else null
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Liste de tous les comptes + profils
select
  u.email,
  p.role,
  p.full_name,
  p.phone,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
