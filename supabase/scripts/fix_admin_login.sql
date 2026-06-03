-- =====================================================================
-- RÉPARATION : "Database error querying schema" à la connexion
-- =====================================================================
-- Cause : comptes créés via INSERT dans auth.users (seed.sql) — format
-- incompatible avec Supabase Auth (GoTrue).
--
-- ⚠ NE PAS ré-exécuter la partie "COMPTES DE DÉMO" de seed.sql sur Cloud.
--
-- ÉTAPE MANUELLE OBLIGATOIRE AVANT CE SCRIPT :
-- 1. Dashboard → Authentication → Users
-- 2. Supprimez admin@easydunya.mr (et driver@ / passenger@ si présents
--    et créés par seed SQL, pas par l'app)
-- 3. Add user → admin@easydunya.mr / mot de passe / Auto Confirm ✓
-- 4. Puis exécutez CE script dans SQL Editor
-- =====================================================================

-- Trigger plus robuste (rôle invalide → passager par défaut)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  resolved_role public.user_role := 'passenger';
begin
  if meta_role in ('passenger', 'driver', 'admin') then
    resolved_role := meta_role::public.user_role;
  end if;

  insert into public.profiles (id, role, full_name, phone, driver_status)
  values (
    new.id,
    resolved_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    case when resolved_role = 'driver' then 'pending'::public.driver_status else null end
  )
  on conflict (id) do update set
    role = excluded.role,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    driver_status = coalesce(excluded.driver_status, public.profiles.driver_status);

  return new;
exception when others then
  -- Ne jamais bloquer la création auth.users
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

-- Promouvoir l'admin créé via le Dashboard (après Add user)
update public.profiles p
   set role = 'admin',
       full_name = coalesce(p.full_name, 'Admin Easy Dunya'),
       phone = coalesce(p.phone, '+22230000001'),
       driver_status = null
  from auth.users u
 where u.id = p.id
   and u.email = 'admin@easydunya.mr';

-- Confirmer tous les emails (dev)
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email_confirmed_at is null;
