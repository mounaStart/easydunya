-- =====================================================================
-- FCM NATIF : jetons d'appareils (APK Capacitor) + envoi automatique.
-- Complète le Web Push : sur l'app native, les notifications s'affichent
-- avec « Easy Dunya » + le logo, même application fermée.
--
-- Pré-requis (voir supabase/functions/send-fcm) :
--   1. Déployer l'Edge Function `send-fcm`
--   2. Définir les secrets FCM de la fonction (compte de service Firebase)
--   3. Renseigner public.app_config (edge_send_fcm_url + token)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Jetons d'appareils (un par appareil natif)
-- ---------------------------------------------------------------------
create table if not exists public.device_tokens (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists idx_device_tokens_user
  on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "fcm: read own" on public.device_tokens;
create policy "fcm: read own"
  on public.device_tokens for select using (user_id = auth.uid());

drop policy if exists "fcm: insert own" on public.device_tokens;
create policy "fcm: insert own"
  on public.device_tokens for insert with check (user_id = auth.uid());

drop policy if exists "fcm: update own" on public.device_tokens;
create policy "fcm: update own"
  on public.device_tokens for update using (user_id = auth.uid());

drop policy if exists "fcm: delete own" on public.device_tokens;
create policy "fcm: delete own"
  on public.device_tokens for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2) Déclencheur : à chaque notification insérée, appeler send-push
--    (web) ET send-fcm (natif) si configurés.
-- ---------------------------------------------------------------------
create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_url      text;
  v_token    text;
  v_fcm_url  text;
  v_fcm_tok  text;
  v_payload  jsonb;
begin
  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   new.title,
    'body',    new.body,
    'data',    new.data
  );

  -- Web Push (navigateur / PWA)
  select value into v_url   from public.app_config where key = 'edge_send_push_url';
  select value into v_token from public.app_config where key = 'edge_send_push_token';
  if v_url is not null then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_token, '')
      ),
      body    := v_payload
    );
  end if;

  -- FCM natif (APK Capacitor)
  select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
  select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
  if v_fcm_url is not null then
    perform net.http_post(
      url     := v_fcm_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
      ),
      body    := v_payload
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
  after insert on public.notifications
  for each row execute function public.tg_notifications_push();

-- ---------------------------------------------------------------------
-- 3) Config à exécuter MANUELLEMENT après déploiement de send-fcm :
--
-- insert into public.app_config(key, value) values
--   ('edge_send_fcm_url',   'https://<PROJECT_REF>.supabase.co/functions/v1/send-fcm'),
--   ('edge_send_fcm_token', '<SERVICE_ROLE_KEY>')
-- on conflict (key) do update set value = excluded.value;
-- ---------------------------------------------------------------------
