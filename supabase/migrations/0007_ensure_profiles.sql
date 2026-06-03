-- =====================================================================
-- EASY DUNYA — Garantir un profil pour chaque utilisateur
-- Problème : la table profiles n'avait AUCUNE policy d'insertion. Les
-- profils n'étaient créés que par le trigger handle_new_user. Si ce
-- trigger n'a pas tourné (compte créé avant, ou erreur), l'utilisateur
-- n'a pas de ligne dans profiles → toute réservation échoue
-- (bookings_passenger_id_fkey).
--
-- Ce script :
--   1) ajoute une policy permettant à un user de créer SON profil ;
--   2) (re)crée un trigger robuste sur auth.users ;
--   3) rétro-crée les profils manquants pour les comptes existants.
-- Réexécutable sans danger.
-- =====================================================================

-- 1) Policy d'insertion (un utilisateur crée uniquement son propre profil)
drop policy if exists "profiles: insert self" on public.profiles;
create policy "profiles: insert self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- 2) Trigger robuste : à la création d'un compte auth, créer le profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role public.user_role;
begin
  begin
    v_role := coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'passenger');
  exception when others then
    v_role := 'passenger';
  end;

  insert into public.profiles (id, role, full_name, phone, driver_status)
  values (
    new.id,
    v_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    case when v_role = 'driver' then 'pending'::public.driver_status else null end
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

-- 3) Backfill des profils manquants pour les comptes déjà existants
insert into public.profiles (id, role, full_name, phone, driver_status)
select
  u.id,
  case
    when u.raw_user_meta_data->>'role' in ('passenger','driver','admin')
      then (u.raw_user_meta_data->>'role')::public.user_role
    else 'passenger'::public.user_role
  end,
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'phone',
  case when u.raw_user_meta_data->>'role' = 'driver'
       then 'pending'::public.driver_status else null end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
