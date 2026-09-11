-- Un seul voyage actif (programmé ou en cours) par chauffeur.

create or replace function public.is_driver_locked(p_driver_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.trips t
    where t.driver_id = p_driver_id
      and t.status in ('scheduled', 'in_progress')
  );
$$;

create or replace function public.check_driver_can_publish_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1
    from public.trips t
    where t.driver_id = new.driver_id
      and t.status in ('scheduled', 'in_progress')
  ) then
    raise exception 'driver has an active trip';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_one_active_per_driver on public.trips;
create trigger trips_one_active_per_driver
  before insert on public.trips
  for each row execute function public.check_driver_can_publish_trip();
