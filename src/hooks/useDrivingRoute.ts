import { useEffect, useState } from "react";
import { fetchDrivingRoute, type DrivingRoute, type RoutePoint } from "../lib/routing";

interface Options {
  /** Arrondi des coordonnées pour le cache (3 ≈ 100 m). */
  precision?: number;
}

/** Distance routière entre deux points (comme Google Maps). */
export function useDrivingRoute(
  from: RoutePoint | null | undefined,
  to: RoutePoint | null | undefined,
  enabled = true,
  options: Options = {}
) {
  const precision = options.precision ?? 3;
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchDrivingRoute(from, to, precision).then((result) => {
      if (cancelled) return;
      setRoute(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, from?.lat, from?.lng, to?.lat, to?.lng, precision]);

  return {
    route,
    distanceM: route?.distanceM ?? null,
    geometry: route?.geometry ?? [],
    loading,
  };
}

/** Distance totale d'un trajet sur la route Google Maps (repli BDD). */
export function useTripRouteDistanceKm(trip: {
  distance_km?: number | null;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
} | null) {
  const from =
    trip && Number.isFinite(trip.from_lat) && Number.isFinite(trip.from_lng)
      ? { lat: trip.from_lat!, lng: trip.from_lng! }
      : null;
  const to =
    trip && Number.isFinite(trip.to_lat) && Number.isFinite(trip.to_lng)
      ? { lat: trip.to_lat!, lng: trip.to_lng! }
      : null;

  const { distanceM, loading } = useDrivingRoute(from, to, !!from && !!to, { precision: 4 });

  if (distanceM != null) return { distanceKm: distanceM / 1000, loading };
  if (trip?.distance_km != null && Number(trip.distance_km) > 0) {
    return { distanceKm: Number(trip.distance_km), loading };
  }
  return { distanceKm: null, loading };
}
