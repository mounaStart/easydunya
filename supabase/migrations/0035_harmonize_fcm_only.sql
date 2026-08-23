-- =====================================================================
-- 0035 — Harmoniser passager + chauffeur : FCM APK uniquement
-- Évite que le chauffeur (sans device_tokens) reçoive du Web Push
-- avec un affichage différent (double logo, icône générique).
-- =====================================================================

create or replace function public.tg_notifications_push()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_fcm_url  text;
  v_fcm_tok  text;
  v_payload  jsonb;
  v_has_fcm  boolean;
begin
  select exists(
    select 1 from public.device_tokens where user_id = new.user_id
  ) into v_has_fcm;

  -- Pas de token FCM → cloche in-app seulement (pas de Web Push).
  if not v_has_fcm then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'user_id', new.user_id,
    'title',   new.title,
    'body',    new.body,
    'type',    new.type,
    'data',    coalesce(new.data, '{}'::jsonb) || jsonb_build_object('type', coalesce(new.type, ''))
  );

  select value into v_fcm_url from public.app_config where key = 'edge_send_fcm_url';
  select value into v_fcm_tok from public.app_config where key = 'edge_send_fcm_token';
  if v_fcm_url is not null then
    begin
      perform net.http_post(
        url     := v_fcm_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_fcm_tok, '')
        ),
        body    := v_payload
      );
    exception when others then
      raise warning 'send-fcm failed for user %: %', new.user_id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

-- Comptes APK : supprimer les abonnements Web Push (affichage différent).
delete from public.push_subscriptions ps
where exists (
  select 1 from public.device_tokens dt where dt.user_id = ps.user_id
);

-- Au enregistrement FCM : plus jamais de Web Push pour ce compte.
create or replace function public.tg_device_token_clear_web_push()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.push_subscriptions where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_device_token_clear_web_push on public.device_tokens;
create trigger trg_device_token_clear_web_push
  after insert or update on public.device_tokens
  for each row execute function public.tg_device_token_clear_web_push();
