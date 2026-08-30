/** Distance routière via Google Directions API (identique à Google Maps). */

import { supabase } from "./supabase";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface DrivingRoute {
  distanceM: number;
  durationS: number;
  geometry: RoutePoint[];
  provider?: "google" | "osrm";
}

const OSRM_BASE = "https://router.project-osrm.org";
const routeCache = new Map<string, DrivingRoute>();

function isValidPoint(p: RoutePoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Clé de cache — arrondi ~100 m pour limiter les appels quand le GPS bouge. */
function cacheKey(from: RoutePoint, to: RoutePoint, precision = 3): string {
  const r = (n: number) => n.toFixed(precision);
  return `${r(from.lat)},${r(from.lng)};${r(to.lat)},${r(to.lng)}`;
}

/** Décode une polyline Google (overview_polyline). */
export function decodeGooglePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

async function fetchGoogleRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRoute | null> {
  const { data, error } = await supabase.functions.invoke("directions", {
    body: { from, to },
  });

  if (error || !data || typeof data !== "object") {
    console.warn("[routing] Google Directions:", error?.message ?? "réponse vide");
    return null;
  }

  const payload = data as {
    distanceM?: number;
    durationS?: number;
    polyline?: string;
    error?: string;
  };

  if (payload.error || !payload.polyline || !Number.isFinite(payload.distanceM)) {
    console.warn("[routing] Google Directions:", payload.error ?? "données invalides");
    return null;
  }

  return {
    distanceM: payload.distanceM!,
    durationS: payload.durationS ?? 0,
    geometry: decodeGooglePolyline(payload.polyline),
    provider: "google",
  };
}

async function fetchOsrmRoute(from: RoutePoint, to: RoutePoint): Promise<DrivingRoute | null> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  try {
    const res = await fetch(
      `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }>;
    };
    if (data.code !== "Ok" || !data.routes?.[0]) return null;

    const r = data.routes[0];
    return {
      distanceM: r.distance,
      durationS: r.duration,
      geometry: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      provider: "osrm",
    };
  } catch {
    return null;
  }
}

/** Distance routière entre deux points (mètres), comme Google Maps. */
export async function fetchDrivingDistanceM(
  from: RoutePoint,
  to: RoutePoint
): Promise<number | null> {
  const route = await fetchDrivingRoute(from, to);
  return route?.distanceM ?? null;
}

/** Distance routière entre deux points (km), arrondie à 0,1 km. */
export async function fetchDrivingDistanceKm(
  from: RoutePoint,
  to: RoutePoint
): Promise<number | null> {
  const meters = await fetchDrivingDistanceM(from, to);
  if (meters == null) return null;
  return Math.round((meters / 1000) * 10) / 10;
}

/** Itinéraire routier complet (Google Maps, repli OSRM si indisponible). */
export async function fetchDrivingRoute(
  from: RoutePoint,
  to: RoutePoint,
  precision = 3
): Promise<DrivingRoute | null> {
  if (!isValidPoint(from) || !isValidPoint(to)) return null;

  const key = cacheKey(from, to, precision);
  const cached = routeCache.get(key);
  if (cached) return cached;

  const googleRoute = await fetchGoogleRoute(from, to);
  if (googleRoute) {
    routeCache.set(key, googleRoute);
    return googleRoute;
  }

  const osrmRoute = await fetchOsrmRoute(from, to);
  if (osrmRoute) {
    routeCache.set(key, osrmRoute);
    return osrmRoute;
  }

  return null;
}
