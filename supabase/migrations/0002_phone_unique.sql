-- =====================================================================
-- 0002_phone_unique.sql
-- Ajoute une contrainte d'unicité sur le numéro de téléphone (profiles.phone)
-- et expose un index. Les téléphones vides/null sont autorisés en doublon.
-- =====================================================================

-- 1) Nettoyer les éventuels doublons existants en gardant la ligne la plus ancienne
with d as (
  select id,
         row_number() over (partition by phone order by created_at) as rn
    from public.profiles
   where phone is not null and length(trim(phone)) > 0
)
update public.profiles p
   set phone = null
  from d
 where d.id = p.id and d.rn > 1;

-- 2) Index UNIQUE partiel (ignore les NULL)
create unique index if not exists profiles_phone_unique
  on public.profiles (phone)
  where phone is not null and length(trim(phone)) > 0;

-- 3) Fonction sécurisée pour vérifier l'unicité du téléphone à l'inscription
--    (sans exposer tout le profil en lecture publique)
create or replace function public.is_phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where phone is not null
       and trim(phone) = trim(p_phone)
  );
$$;

revoke all on function public.is_phone_taken(text) from public;
grant execute on function public.is_phone_taken(text) to anon, authenticated;
