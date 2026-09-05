/** Distance routière via Google Directions API (identique à Google Maps). */

import { supabase } from "./supabase";
import { distanceKm } from "./utils";

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface DrivingRoute {
  distanceM: number;
  durationS: number;
  geometry: RoutePoint[];
  provider: "google";
}

export type RouteFetchStatus = "loading" | "google" | "fallback";

export interface DrivingRouteResult {
  route: DrivingRoute | null;
  status: RouteFetchStatus;
  /** Message d'erreur Google Directions (console + UI). */
  error?: string;
}

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

async function fetchGoogleRoute(
  from: RoutePoint,
  to: RoutePoint
): Promise<{ route: DrivingRoute | null; error?: string }> {
  const { data, error } = await supabase.functions.invoke("directions", {
    body: { from, to },
  });

  if (error || !data || typeof data !== "object") {
    const msg = error?.message ?? "réponse vide";
    console.warn("[routing] Google Directions:", msg);
    return { route: null, error: msg };
  }

  const payload = data as {
    distanceM?: number;
    durationS?: number;
    polyline?: string;
    error?: string;
  };

  if (payload.error || !payload.polyline || !Number.isFinite(payload.distanceM)) {
    const msg = payload.error ?? "données invalides";
    console.warn("[routing] Google Directions:", msg);
    return { route: null, error: msg };
  }

  return {
    route: {
      distanceM: payload.distanceM!,
      durationS: payload.durationS ?? 0,
      geometry: decodeGooglePolyline(payload.polyline),
      provider: "google",
    },
  };
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

/** Itinéraire routier complet (Google Directions uniquement). */
export async function fetchDrivingRouteWithStatus(
  from: RoutePoint,
  to: RoutePoint,
  precision = 3
): Promise<DrivingRouteResult> {
  if (!isValidPoint(from) || !isValidPoint(to)) {
    return { route: null, status: "fallback", error: "Coordonnées invalides" };
  }

  const key = cacheKey(from, to, precision);
  const cached = routeCache.get(key);
  if (cached) {
    return { route: cached, status: "google" };
  }

  const { route, error } = await fetchGoogleRoute(from, to);
  if (route) {
    routeCache.set(key, route);
    return { route, status: "google" };
  }

  console.warn(
    "[routing] Google Directions indisponible — configurez GOOGLE_MAPS_API_KEY sur Supabase (Edge Function directions). Voir docs/GOOGLE-DIRECTIONS.md"
  );
  return {
    route: null,
    status: "fallback",
    error: error ?? "Google Directions indisponible",
  };
}

/** Itinéraire routier complet (Google Directions uniquement). */
export async function fetchDrivingRoute(
  from: RoutePoint,
  to: RoutePoint,
  precision = 3
): Promise<DrivingRoute | null> {
  const result = await fetchDrivingRouteWithStatus(from, to, precision);
  return result.route;
}

function pointDistanceM(a: RoutePoint, b: RoutePoint): number {
  return distanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

export interface PolylineSnap {
  point: RoutePoint;
  segmentIndex: number;
  distToTargetM: number;
}

function snapOnSegment(a: RoutePoint, b: RoutePoint, target: RoutePoint): RoutePoint {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const bx = (b.lng - a.lng) * lngScale;
  const by = (b.lat - a.lat) * latScale;
  const px = (target.lng - a.lng) * lngScale;
  const py = (target.lat - a.lat) * latScale;
  const len2 = bx * bx + by * by;
  let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

function segmentSnaps(geometry: RoutePoint[], target: RoutePoint): PolylineSnap[] {
  if (geometry.length < 2) return [];
  const snaps: PolylineSnap[] = [];
  for (let i = 0; i < geometry.length - 1; i++) {
    const point = snapOnSegment(geometry[i], geometry[i + 1], target);
    snaps.push({
      point,
      segmentIndex: i,
      distToTargetM: pointDistanceM(point, target),
    });
  }
  return snaps;
}

/** Point le plus proche sur la polyligne (projection sur chaque segment). */
export function nearestPointOnPolyline(
  geometry: RoutePoint[],
  target: RoutePoint
): PolylineSnap | null {
  if (geometry.length === 0) return null;
  if (geometry.length === 1) {
    return {
      point: geometry[0],
      segmentIndex: 0,
      distToTargetM: pointDistanceM(geometry[0], target),
    };
  }

  let best: PolylineSnap | null = null;
  for (const snap of segmentSnaps(geometry, target)) {
    if (!best || snap.distToTargetM < best.distToTargetM) {
      best = snap;
    }
  }
  return best;
}

/**
 * Première approche le long du trajet (depuis le départ) — évite les boucles
 * Google en ville (ex. Aleg → Nouakchott via Toujounine après Rue de l'Espoir).
 */
function firstApproachSnap(
  geometry: RoutePoint[],
  target: RoutePoint,
  approachMaxM = 800
): PolylineSnap | null {
  const snaps = segmentSnaps(geometry, target);
  if (!snaps.length) return null;

  let globalMin = Infinity;
  for (const snap of snaps) {
    globalMin = Math.min(globalMin, snap.distToTargetM);
  }
  const toleranceM = Math.max(approachMaxM, globalMin + 250);

  for (const snap of snaps) {
    if (snap.distToTargetM <= toleranceM) {
      return snap;
    }
  }

  return nearestPointOnPolyline(geometry, target);
}

/** Meilleur snap près du départ (premiers ~12 % de la polyligne). */
function departureSnap(geometry: RoutePoint[], target: RoutePoint): PolylineSnap | null {
  if (geometry.length < 2) return null;
  const limit = Math.max(1, Math.ceil((geometry.length - 1) * 0.12));
  let best: PolylineSnap | null = null;
  for (let i = 0; i < limit; i++) {
    const point = snapOnSegment(geometry[i], geometry[i + 1], target);
    const snap: PolylineSnap = {
      point,
      segmentIndex: i,
      distToTargetM: pointDistanceM(point, target),
    };
    if (!best || snap.distToTargetM < best.distToTargetM) {
      best = snap;
    }
  }
  return best;
}

function polylineLengthM(geometry: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    total += pointDistanceM(geometry[i], geometry[i + 1]);
  }
  return total;
}

export interface TruncatedRoute {
  fromPoint: RoutePoint;
  toPoint: RoutePoint;
  path: RoutePoint[];
}

function slicePolyline(
  geometry: RoutePoint[],
  startIdx: number,
  startPoint: RoutePoint,
  endIdx: number,
  endPoint: RoutePoint
): RoutePoint[] {
  const path: RoutePoint[] = [startPoint];
  for (let i = startIdx + 1; i <= endIdx + 1 && i < geometry.length; i++) {
    path.push(geometry[i]);
  }
  const last = path[path.length - 1];
  if (pointDistanceM(last, endPoint) > 8) {
    path.push(endPoint);
  } else {
    path[path.length - 1] = endPoint;
  }
  return path;
}

/**
 * Tronque la géométrie Google entre les entrées ville (départ + arrivée).
 * Arrivée = première approche sur la route (pas la boucle Google en ville).
 */
export function truncateRouteBothEnds(
  geometry: RoutePoint[],
  fromTarget: RoutePoint,
  toTarget: RoutePoint
): TruncatedRoute {
  if (geometry.length < 2) {
    return { fromPoint: fromTarget, toPoint: toTarget, path: [fromTarget, toTarget] };
  }

  const fromSnap = departureSnap(geometry, fromTarget);
  const toSnap = firstApproachSnap(geometry, toTarget);

  if (!toSnap) {
    return { fromPoint: fromTarget, toPoint: toTarget, path: geometry };
  }

  let startIdx = fromSnap?.segmentIndex ?? 0;
  let startPoint = fromSnap?.point ?? geometry[0];
  let endIdx = toSnap.segmentIndex;
  let endPoint = toSnap.point;

  if (fromSnap && fromSnap.segmentIndex > endIdx) {
    startIdx = 0;
    startPoint = geometry[0];
  }

  const path = slicePolyline(geometry, startIdx, startPoint, endIdx, endPoint);

  if (path.length < 2 || polylineLengthM(path) < 500) {
    return { fromPoint: fromTarget, toPoint: toTarget, path: geometry };
  }

  return { fromPoint: startPoint, toPoint: endPoint, path };
}

/** Distance restante le long de l'itinéraire (fin de voyage fiable à l'arrivée). */
export function remainingOnRouteM(geometry: RoutePoint[], driver: RoutePoint): number | null {
  if (geometry.length === 0) return null;
  if (geometry.length === 1) return pointDistanceM(driver, geometry[0]);

  const routeEnd = geometry[geometry.length - 1];
  let bestRemaining = Infinity;

  for (let i = 0; i < geometry.length - 1; i++) {
    const a = geometry[i];
    const b = geometry[i + 1];
    const latScale = 111320;
    const lngScale = 111320 * Math.cos((a.lat * Math.PI) / 180);
    const bx = (b.lng - a.lng) * lngScale;
    const by = (b.lat - a.lat) * latScale;
    const px = (driver.lng - a.lng) * lngScale;
    const py = (driver.lat - a.lat) * latScale;
    const len2 = bx * bx + by * by;
    let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
    t = Math.max(0, Math.min(1, t));
    const proj = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    const offRouteM = pointDistanceM(driver, proj);
    if (offRouteM > 3000) continue;

    let remaining = 0;
    if (t < 1) remaining += pointDistanceM(proj, b);
    for (let j = i + 1; j < geometry.length - 1; j++) {
      remaining += pointDistanceM(geometry[j], geometry[j + 1]);
    }
    if (offRouteM > 400) remaining += offRouteM * 0.5;
    bestRemaining = Math.min(bestRemaining, remaining);
  }

  if (!Number.isFinite(bestRemaining)) {
    return pointDistanceM(driver, routeEnd);
  }

  return Math.min(bestRemaining, pointDistanceM(driver, routeEnd));
}

/** Distance restante chauffeur → destination (comme Google Maps ETA). */
export async function fetchRemainingToDestinationM(
  driver: RoutePoint,
  to: RoutePoint
): Promise<{ remainingM: number; geometry: RoutePoint[] | null }> {
  const route = await fetchDrivingRoute(driver, to, 4);
  if (route) {
    return { remainingM: route.distanceM, geometry: route.geometry };
  }
  return { remainingM: pointDistanceM(driver, to), geometry: null };
}

/** Distance restante pour terminer le voyage (itinéraire + repli direct). */
export async function fetchTripRemainingM(
  from: RoutePoint,
  to: RoutePoint,
  driver: RoutePoint,
  cachedGeometry?: RoutePoint[] | null
): Promise<{ remainingM: number; geometry: RoutePoint[] | null }> {
  let geometry = cachedGeometry ?? null;
  if (!geometry?.length) {
    const route = await fetchDrivingRoute(from, to, 4);
    geometry = route?.geometry ?? null;
  }

  const straightToDestM = pointDistanceM(driver, to);

  if (geometry?.length) {
    const alongM = remainingOnRouteM(geometry, driver);
    const toRouteEndM = pointDistanceM(driver, geometry[geometry.length - 1]);
    const remainingM = Math.min(
      alongM ?? Infinity,
      straightToDestM,
      toRouteEndM
    );
    return { remainingM, geometry };
  }

  const directRouteM = await fetchDrivingDistanceM(driver, to);
  const remainingM = Math.min(straightToDestM, directRouteM ?? straightToDestM);
  return { remainingM, geometry: null };
}
