import type { RoutePoint } from "./routing";

function pointDistanceM(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 1000;
}

/** Point d'arrivée fixe = entrée ville (to_lat/to_lng), jamais la position chauffeur. */
export function isNearTripEntrance(
  driver: RoutePoint,
  entrance: RoutePoint,
  radiusM = 500
): boolean {
  return pointDistanceM(driver, entrance) <= radiusM;
}
