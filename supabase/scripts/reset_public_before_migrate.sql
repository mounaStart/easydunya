-- =====================================================================
-- RESET schéma PUBLIC — projet prfmqfnaqtmyfyxqjeli
-- À exécuter AVANT bootstrap_prfmqfna_ALL_MIGRATIONS.sql
--
-- Pourquoi ? Si une ancienne tentative a créé des tables incomplètes
-- (ex. profiles sans full_name), « create table if not exists » ne
-- corrige pas → erreur « column d.full_name does not exist ».
--
-- ⚠ Ne touche PAS auth.users (vos comptes restent).
-- ⚠ Supprime toutes les tables/vues/fonctions du schéma public.
-- =====================================================================

-- 1) Vues
do $$
declare r record;
begin
  for r in
    select viewname as name
    from pg_views
    where schemaname = 'public'
  loop
    execute format('drop view if exists public.%I cascade', r.name);
  end loop;
end $$;

-- 2) Tables (CASCADE enlève FK entre tables public)
do $$
declare r record;
begin
  for r in
    select tablename as name
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.name);
  end loop;
end $$;

-- 3) Fonctions public (reste propre pour réinstaller les migrations)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end $$;

-- 4) Types enum public
do $$
declare r record;
begin
  for r in
    select t.typname as name
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.name);
  end loop;
end $$;

-- 5) Vérification : plus aucune table public
select coalesce(
  (select string_agg(tablename, ', ' order by tablename)
   from pg_tables where schemaname = 'public'),
  '(vide — OK, lancez bootstrap_prfmqfna_ALL_MIGRATIONS.sql)'
) as tables_public_restantes;
