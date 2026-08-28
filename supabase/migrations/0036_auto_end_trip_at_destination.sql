-- =====================================================================
-- 0036 — Terminer automatiquement le voyage à 500 m de la destination
-- Avant : driver_update_gps ne faisait que current_trip_id = null (déblocage)
--         → le voyage restait "in_progress" jusqu'à action admin/manuelle.
-- Désormais : appelle driver_end_trip (statut completed, paiements, notifs).
-- =====================================================================

create or replace function public.driver_update_gps(
  p_trip_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_dest record;
  v_dist_km numeric := null;
  v_completed boolean := false;
begin
  if v_driver is null then
    raise exception 'not authenticated';
  end if;

  insert into public.driver_positions (trip_id, driver_id, latitude, longitude)
  values (p_trip_id, v_driver, p_lat, p_lng);

  select
    t.id,
    t.driver_id,
    t.status,
    coalesce(ct.latitude, cf.latitude) as dest_lat,
    coalesce(ct.longitude, cf.longitude) as dest_lng
  into v_dest
  from public.trips t
  join public.cities cf on cf.id = t.from_city_id
  join public.cities ct on ct.id = t.to_city_id
  where t.id = p_trip_id
    and t.driver_id = v_driver
    and t.status = 'in_progress';

  if found
    and v_dest.dest_lat is not null
    and v_dest.dest_lng is not null
  then
    v_dist_km := 6371 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_lat)) * cos(radians(v_dest.dest_lat))
        * cos(radians(v_dest.dest_lng) - radians(p_lng))
        + sin(radians(p_lat)) * sin(radians(v_dest.dest_lat))
      ))
    );

    if v_dist_km <= 0.5 then
      perform public.driver_end_trip(p_trip_id);
      v_completed := true;
    end if;
  end if;

  return jsonb_build_object(
    'completed', v_completed,
    'unlocked', v_completed,
    'distance_km', round(coalesce(v_dist_km, 0)::numeric, 2)
  );
end;
$$;

grant execute on function public.driver_update_gps(uuid, double precision, double precision) to authenticated;
