-- =====================================================================
-- Aligner public.push_subscriptions sur le code (Web Push).
-- La table créée en 0001 utilisait "auth_key" et n'avait pas "user_agent".
-- Le client et l'Edge Function send-push attendent "auth" + "user_agent".
-- (0015 faisait "create table if not exists" => sans effet sur l'existant.)
-- =====================================================================

do $$
begin
  -- 1) Colonne "auth" : renommer auth_key -> auth si besoin, sinon créer
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth_key'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth'
  ) then
    alter table public.push_subscriptions rename column auth_key to auth;
  end if;

  -- Si ni auth ni auth_key n'existent (cas improbable), créer auth
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'push_subscriptions'
      and column_name = 'auth'
  ) then
    alter table public.push_subscriptions add column auth text;
  end if;
end $$;

-- 2) Colonne user_agent (présente dans 0015, absente de 0001)
alter table public.push_subscriptions
  add column if not exists user_agent text;

-- 3) Recharger le cache de schéma PostgREST (sinon erreur 400 persiste)
notify pgrst, 'reload schema';

-- 4) Vérification
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'push_subscriptions'
order by ordinal_position;
