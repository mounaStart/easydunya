-- =====================================================================
-- 0005_fix_admin_rls.sql
-- Corrige l'approbation chauffeur par l'admin (RLS bloquait les UPDATE)
-- =====================================================================

-- 1) Fonction rôle : SECURITY DEFINER pour éviter la récursion RLS
create or replace function public.current_role_safe()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- 2) Politiques UPDATE profiles (admin peut modifier tous les profils)
drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all"
  on public.profiles
  for update
  using (public.current_role_safe() = 'admin')
  with check (public.current_role_safe() = 'admin');

-- 3) RPC dédiée : mise à jour du statut chauffeur (fiable, 1 appel)
create or replace function public.admin_set_driver_status(
  p_driver_id uuid,
  p_status public.driver_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role <> 'admin' then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
     where id = p_driver_id and role = 'driver'
  ) then
    raise exception 'not a driver profile' using errcode = 'P0002';
  end if;

  update public.profiles
     set driver_status = p_status,
         updated_at = now()
   where id = p_driver_id;
end;
$$;

revoke all on function public.admin_set_driver_status(uuid, public.driver_status) from public;
grant execute on function public.admin_set_driver_status(uuid, public.driver_status) to authenticated;
