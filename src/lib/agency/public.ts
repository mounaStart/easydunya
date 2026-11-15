import { useEffect, useMemo, useState } from "react";
import type { TripPublic } from "../types";
import { AGENCY_CITIES, FALLBACK_TRIP_CITIES } from "./cities";
import { freeSeatCount } from "./rules";
import { getAgencyDb, publishedTripsForSearch, subscribeAgency } from "./store";
import { displayFromPrice, isMultiStop, tripStops } from "./trip";
import type { AgencyDB, AgencyTrip } from "./types";

export { FALLBACK_TRIP_CITIES };

const CITY_COORDS: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  AGENCY_CITIES.map((c) => [c.id, { lat: c.lat, lng: c.lng }])
);

export const AGENCY_TRIP_PREFIX = "agency:";

export function isAgencyTripPublicId(id: string | undefined | null): boolean {
  return !!id && id.startsWith(AGENCY_TRIP_PREFIX);
}

export function agencyTripPath(id: string, fromId?: string, toId?: string): string {
  const raw = id.startsWith(AGENCY_TRIP_PREFIX) ? id.slice(AGENCY_TRIP_PREFIX.length) : id;
  const q = new URLSearchParams();
  if (fromId) q.set("from", fromId);
  if (toId) q.set("to", toId);
  const qs = q.toString();
  return `/agence/voyage/${raw}${qs ? `?${qs}` : ""}`;
}

export function agencyToTripPublic(db: AgencyDB, t: AgencyTrip): TripPublic {
  const agency = db.agencies.find((a) => a.id === t.agencyId);
  const vehicle = db.vehicles.find((v) => v.id === t.vehicleId);
  const from = CITY_COORDS[t.fromCityId] ?? { lat: 18.0735, lng: -15.9582 };
  const to = CITY_COORDS[t.toCityId] ?? from;
  return {
    id: `${AGENCY_TRIP_PREFIX}${t.id}`,
    driver_id: t.agencyId,
    vehicle_id: t.vehicleId,
    from_city_id: t.fromCityId,
    to_city_id: t.toCityId,
    depart_at: t.departAt,
    price_per_seat: displayFromPrice(t),
    seats_total: t.seats,
    seats_available: freeSeatCount(db, t),
    notes: isMultiStop(t)
      ? [`Via ${tripStops(t).slice(1, -1).map((s) => s.city).join(", ")}`, t.notes]
          .filter(Boolean)
          .join(" · ")
      : t.notes,
    status: "scheduled",
    started_at: null,
    ended_at: null,
    created_at: t.departAt,
    driver_name: agency?.name ?? "Agence",
    driver_rating: null,
    driver_rating_count: 0,
    vehicle_label: vehicle ? `${vehicle.brand} ${vehicle.model}` : "Agence",
    vehicle_make: vehicle?.brand ?? null,
    vehicle_plate: vehicle?.plate ?? null,
    vehicle_seats: vehicle?.seats ?? t.seats,
    driver_photo: null,
    from_name_fr: t.fromName,
    from_name_ar: t.fromName,
    from_lat: from.lat,
    from_lng: from.lng,
    to_name_fr: t.toName,
    to_name_ar: t.toName,
    to_lat: to.lat,
    to_lng: to.lng,
    depart_lat: from.lat,
    depart_lng: from.lng,
    depart_quartier: t.meeting,
  };
}

export function publicTripMatchesCities(tr: TripPublic, fromId?: string, toId?: string): boolean {
  if (!isAgencyTripPublicId(tr.id)) {
    if (fromId && tr.from_city_id !== fromId) return false;
    if (toId && tr.to_city_id !== toId) return false;
    return true;
  }
  const raw = getAgencyDb().trips.find((t) => `${AGENCY_TRIP_PREFIX}${t.id}` === tr.id);
  if (!raw) return false;
  return agencyTripMatchesRoute(raw, fromId || undefined, toId || undefined);
}

export function stopIndicesForRoute(
  t: AgencyTrip,
  fromId?: string,
  toId?: string
): { fromIdx: number; toIdx: number } | null {
  const ids = tripStops(t).map((s) => s.cityId);
  const fi = fromId ? ids.indexOf(fromId) : 0;
  const ti = toId ? ids.lastIndexOf(toId) : ids.length - 1;
  if (fromId && fi < 0) return null;
  if (toId && ti < 0) return null;
  if (fi < 0 || ti < 0 || fi >= ti) return null;
  return { fromIdx: fi, toIdx: ti };
}

export function agencyTripMatchesRoute(t: AgencyTrip, fromId?: string, toId?: string): boolean {
  return stopIndicesForRoute(t, fromId, toId) != null;
}

export function useAgencyPublicTrips(): TripPublic[] {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  const db = getAgencyDb();
  return useMemo(
    () =>
      publishedTripsForSearch()
        .filter((t) => db.agencies.find((a) => a.id === t.agencyId)?.status === "approved")
        .map((t) => agencyToTripPublic(db, t)),
    [db]
  );
}
