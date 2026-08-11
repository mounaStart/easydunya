-- =====================================================================
-- SÉCURITÉ — Bloquer l'escalade admin (migration 0026)
-- Exécuter dans Supabase → SQL Editor (prfmqfna) → Run
-- =====================================================================

-- 1) Inscription auth : toujours passager
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, driver_status)
  values (
    new.id,
    'passenger'::public.user_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    null
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Insert self : passager uniquement
drop policy if exists "profiles: insert self" on public.profiles;
create policy "profiles: insert self"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'passenger'::public.user_role);

-- 3) Trigger anti-escalade role / driver_status
create or replace function public.tg_profiles_guard_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text;
begin
  v_jwt_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (select auth.jwt()->>'role'),
    ''
  );

  if v_jwt_role = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if public.current_role_safe() = 'admin'::public.user_role then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      raise exception 'Modification du rôle interdite.' using errcode = '42501';
    end if;
    if new.driver_status is distinct from old.driver_status then
      raise exception 'Modification du statut chauffeur interdite.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'passenger'::public.user_role then
      raise exception 'Création de profil avec un rôle privilégié interdite.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard_privileged_fields on public.profiles;
create trigger trg_profiles_guard_privileged_fields
  before insert or update on public.profiles
  for each row execute function public.tg_profiles_guard_privileged_fields();

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- 4) Diagnostic : lister les admins (vérifier qu'ils sont légitimes)
select 'comptes admin' as info, p.id, p.phone, p.full_name, p.created_at,
       u.raw_user_meta_data->>'role' as meta_role_inscription
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin'
order by p.created_at;

-- 5) Si un faux admin apparaît (inscription publique), le repasser passager :
-- update public.profiles set role = 'passenger', driver_status = null
-- where id = 'UUID_DU_FAUX_ADMIN';

select 'Migration 0026 appliquée ✓' as status;
