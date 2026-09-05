/** Calculs de distance / itinéraire (Node + tests, sans dépendance app). */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function pointDistanceM(a, b) {
  return distanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

/** Distance restante le long de la polyline (même algo que l'app). */
export function remainingOnRouteM(geometry, driver) {
  if (!geometry?.length) return null;
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

/** Comme fetchTripRemainingM côté app. */
export function tripRemainingM(geometry, from, to, driver) {
  const straightToDestM = pointDistanceM(driver, to);
  if (!geometry?.length) return straightToDestM;

  const alongM = remainingOnRouteM(geometry, driver);
  const toRouteEndM = pointDistanceM(driver, geometry[geometry.length - 1]);
  return Math.min(alongM ?? Infinity, straightToDestM, toRouteEndM);
}

export function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
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

export function formatM(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/** Villes seed Easy Dunya (coords BDD). */
export const CITIES = {
  nouakchott: { name: "Nouakchott", lat: 18.0681, lng: -15.9700 },
  arafat: { name: "Arafat", lat: 18.0462, lng: -15.9183 },
  tevragh: { name: "Tevragh Zeina", lat: 18.0954, lng: -15.9761 },
  aleg: { name: "Aleg", lat: 17.0522, lng: -13.9179 },
  rosso: { name: "Rosso", lat: 16.5223, lng: -15.8109 },
};

export async function fetchOsrmRoute(from, to) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  );
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(`OSRM: ${data.code ?? "no route"}`);
  }
  const r = data.routes[0];
  return {
    distanceM: r.distance,
    durationS: r.duration,
    geometry: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    provider: "osrm",
  };
}

export async function fetchGoogleRoute(from, to, supabaseUrl, anonKey) {
  const res = await fetch(`${supabaseUrl}/functions/v1/directions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ from, to }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return {
    distanceM: data.distanceM,
    durationS: data.durationS,
    geometry: decodeGooglePolyline(data.polyline),
    provider: "google",
  };
}

/** Point à X % le long de la polyline (0 = départ, 1 = arrivée). */
export function pointAtProgress(geometry, progress) {
  if (!geometry.length) return null;
  if (progress <= 0) return { ...geometry[0] };
  if (progress >= 1) return { ...geometry[geometry.length - 1] };

  const cum = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1] + pointDistanceM(geometry[i - 1], geometry[i]));
  }
  const total = cum[cum.length - 1];
  const target = total * progress;

  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= target) {
      const segLen = cum[i] - cum[i - 1];
      const t = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen;
      const a = geometry[i - 1];
      const b = geometry[i];
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
    }
  }
  return { ...geometry[geometry.length - 1] };
}

export function loadDotEnv(rootDir = process.cwd()) {
  try {
    const text = readFileSync(join(rootDir, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* pas de .env */
  }
}
