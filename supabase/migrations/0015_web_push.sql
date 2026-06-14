-- =====================================================================
-- WEB PUSH : abonnements navigateur + envoi automatique à chaque
-- notification insérée. Les notifications apparaissent alors dans la
-- barre du téléphone (avec son/vibration) MÊME application fermée.
--
-- Pré-requis (voir supabase/functions/send-push) :
--   1. Déployer l'Edge Function `send-push`
--   2. Définir les secrets VAPID de la fonction
--   3. Renseigner public.app_config (URL + token) — voir plus bas
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- 1) Abonnements push (un par appareil/navigateur)
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: read own" on public.push_subscriptions;
create policy "push: read own"
  on public.push_subscriptions for select using (user_id = auth.uid());

drop policy if exists "push: insert own" on public.push_subscriptions;
create policy "push: insert own"
  on public.push_subscriptions for insert with check (user_id = auth.uid());

drop policy if exists "push: update own" on public.push_subscriptions;
create policy "push: update own"
  on public.push_subscriptions for update using (user_id = auth.uid());

drop policy if exists "push: delete own" on public.push_subscriptions;
create policy "push: delete own"
  on public.push_subscriptions for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) Config privée (URL de la fonction + token d'appel)
--    Aucun accès anon/authenticated : seul le trigger SECURITY DEFINER lit.
-- ---------------------------------------------------------------------
create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;

-- ⚠️ À EXÉCUTER MANUELLEMENT après déploiement de l'Edge Function
--    (remplacez <PROJECT_REF> et <SERVICE_ROLE_KEY>) :
--
-- insert into public.app_config(key, value) values
--   ('edge_send_push_url',   'https://<PROJECT_REF>.supabase.co/functions/v1/send-push'),
--   ('edge_send_push_token', '<SERVICE_ROLE_KEY>')
-- on conflict (key) do update set value = excluded.value;

-- ---------------------------------------------------------------------
-- 3) Déclencheur : à chaque notification insérée, appeler l'Edge Function
-- ---------------------------------------------------------------------
create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url   text;
  v_token text;
begin
  select value into v_url   from public.app_config where key = 'edge_send_push_url';
  select value into v_token from public.app_config where key = 'edge_send_push_token';

  -- Pas encore configuré : on ne bloque pas l'insertion de la notification
  if v_url is null then
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_token, '')
    ),
    body    := jsonb_build_object(
      'user_id', new.user_id,
      'title',   new.title,
      'body',    new.body,
      'data',    new.data
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.tg_notifications_push();
