-- =====================================================================
-- Empêcher l'écrasement d'un compte existant (ex: admin demandé en passager)
-- en comparant les numéros NORMALISÉS (chiffres uniquement).
-- =====================================================================

create or replace function public.is_phone_taken(p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join auth.users u on u.id = p.id
    where regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
            = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
       or regexp_replace(coalesce(u.email, ''), '\D', '', 'g')
            like regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') || '%'
  );
$$;

revoke all on function public.is_phone_taken(text) from public;
grant execute on function public.is_phone_taken(text) to anon, authenticated;
