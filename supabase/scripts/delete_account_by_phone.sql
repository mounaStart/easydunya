-- =====================================================================
-- SUPPRIMER UN COMPTE PRÉCIS (par numéro de téléphone)
-- Utile pour retirer le chauffeur/compte en trop repéré via diag_accounts.sql
-- Remplace la valeur ci-dessous, puis exécute.
-- =====================================================================

do $$
declare
  v_phone text := '20986280';   -- <<< METTRE ICI le téléphone du compte à supprimer
  v_id uuid;
begin
  -- on cherche le compte par le téléphone du profil
  select id into v_id from public.profiles where phone = v_phone limit 1;

  if v_id is null then
    raise notice 'Aucun profil avec le téléphone %', v_phone;
    return;
  end if;

  -- sécurité : empêcher de supprimer le DERNIER admin
  if exists (select 1 from public.profiles where id = v_id and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise notice 'Refus : ce compte est le dernier admin.';
    return;
  end if;

  delete from auth.users where id = v_id;  -- cascade -> profil + données liées
  raise notice 'Compte % (%s) supprimé.', v_phone, v_id;
end $$;

-- Vérification
select id, role, full_name, phone from public.profiles order by role;
