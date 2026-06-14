-- =====================================================================
-- Vérifier / réparer l'infrastructure NOTIFICATIONS + REALTIME
-- À exécuter dans Supabase → SQL Editor
-- =====================================================================

-- 0) S'assurer que les colonnes de réservation existent (sinon l'INSERT échoue
--    silencieusement côté passager => ni réservation ni notification)
alter table public.bookings add column if not exists pickup_lat      double precision;
alter table public.bookings add column if not exists pickup_lng      double precision;
alter table public.bookings add column if not exists pickup_quartier text;
alter table public.bookings add column if not exists is_waiting      boolean not null default false;

-- 1) Table notifications (si pas déjà créée par 0008)
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text,
  type       text,
  data       jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select using (user_id = auth.uid());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own"
  on public.notifications for update using (user_id = auth.uid());

-- 2) Fonction d'envoi (SECURITY DEFINER)
create or replace function public.notify_user(
  p_user uuid, p_title text, p_body text default null,
  p_type text default null, p_data jsonb default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, title, body, type, data)
  values (p_user, p_title, p_body, p_type, p_data);
end;
$$;

grant execute on function public.notify_user(uuid,text,text,text,jsonb) to authenticated;

-- 3) Activer Realtime sur notifications (la cloche se met à jour en direct)
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then
    -- déjà ajoutée
    null;
  end;
end $$;

-- 4) S'assurer que bookings est bien en realtime aussi
do $$
begin
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then
    null;
  end;
end $$;

-- 5) Test rapide : envoyer une notification à soi-même (admin connecté)
-- select public.notify_user(auth.uid(), 'Test', 'Ceci est un test');

-- 6) Vérifier les dernières notifications
select id, user_id, title, body, read, created_at
from public.notifications
order by created_at desc
limit 10;
