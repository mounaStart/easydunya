#!/usr/bin/env node
/** Valide troncature Aleg → Nouakchott (plus de boucle Toujounine). */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnv, pointDistanceM } from "./lib/route-math.mjs";

function decodeGooglePolyline(encoded) {
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

function snapOnSegment(a, b, target) {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((a.lat * Math.PI) / 180);
  const bx = (b.lng - a.lng) * lngScale;
  const by = (b.lat - a.lat) * latScale;
  const px = (target.lng - a.lng) * lngScale;
  const py = (target.lat - a.lat) * latScale;
  const len2 = bx * bx + by * by;
  let t = len2 === 0 ? 0 : (px * bx + py * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function segmentSnaps(geometry, target) {
  const snaps = [];
  for (let i = 0; i < geometry.length - 1; i++) {
    const point = snapOnSegment(geometry[i], geometry[i + 1], target);
    snaps.push({ point, segmentIndex: i, distToTargetM: pointDistanceM(point, target) });
  }
  return snaps;
}

function firstApproachSnap(geometry, target, approachMaxM = 800) {
  const snaps = segmentSnaps(geometry, target);
  if (!snaps.length) return null;
  let globalMin = Infinity;
  for (const snap of snaps) globalMin = Math.min(globalMin, snap.distToTargetM);
  const toleranceM = Math.max(approachMaxM, globalMin + 250);
  for (const snap of snaps) {
    if (snap.distToTargetM <= toleranceM) return snap;
  }
  return null;
}

function truncateRouteBothEnds(geometry, fromTarget, toTarget) {
  const toSnap = firstApproachSnap(geometry, toTarget);
  if (!toSnap) return { path: geometry, toPoint: toTarget };
  const path = geometry.slice(0, toSnap.segmentIndex + 2);
  path[path.length - 1] = toSnap.point;
  return { path, toPoint: toSnap.point };
}

async function main() {
  loadDotEnv();
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const from = { lat: 17.0522, lng: -13.9179 };
  const entrance = { lat: 18.0583, lng: -15.8652 };

  const { data } = await sb.functions.invoke("directions", { body: { from, to: entrance } });
  const geom = decodeGooglePolyline(data.polyline);
  const trunc = truncateRouteBothEnds(geom, from, entrance);

  const maxLatFull = Math.max(...geom.slice(-40).map((p) => p.lat));
  const maxLatTrunc = Math.max(...trunc.path.slice(-10).map((p) => p.lat));

  console.log("Route Google → entrée Rue Espoir");
  console.log("  points:", geom.length, "→ tronqué:", trunc.path.length);
  console.log("  max lat (fin route):", maxLatFull.toFixed(4), "→", maxLatTrunc.toFixed(4));
  console.log("  Toujounine loop (>18.062)?", maxLatTrunc > 18.062 ? "OUI ❌" : "NON ✅");
  console.log("  fin tronquée:", trunc.toPoint.lat.toFixed(4), trunc.toPoint.lng.toFixed(4));
}

main().catch(console.error);
