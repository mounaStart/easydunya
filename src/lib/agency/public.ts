import { useEffect, useMemo, useState } from "react";
import type { TripPublic } from "../types";
import { freeSeatCount } from "./rules";
import { getAgencyDb, publishedTripsForSearch, subscribeAgency } from "./store";
import type { AgencyDB, AgencyTrip } from "./types";

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "11111111-1111-1111-1111-000000000001": { lat: 18.0735, lng: -15.9582 },
  "11111111-1111-1111-1111-000000000003": { lat: 16.5128, lng: -15.805 },
  "11111111-1111-1111-1111-000000000004": { lat: 16.592, lng: -14.27 },
  "11111111-1111-1111-1111-000000000005": { lat: 16.1503, lng: -13.5037 },
};

export const AGENCY_TRIP_PREFIX = "agency:";

export function isAgencyTripPublicId(id: string | undefined | null): boolean {
  return !!id && id.startsWith(AGENCY_TRIP_PREFIX);
}

export function agencyTripPath(id: string): string {
  const raw = id.startsWith(AGENCY_TRIP_PREFIX) ? id.slice(AGENCY_TRIP_PREFIX.length) : id;
  return `/agence/voyage/${raw}`;
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
    price_per_seat: t.price,
    seats_total: t.seats,
    seats_available: freeSeatCount(db, t),
    notes: t.notes,
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

export const FALLBACK_TRIP_CITIES = [
  { id: "11111111-1111-1111-1111-000000000001", name_fr: "Nouakchott", name_ar: "نواكشوط" },
  { id: "11111111-1111-1111-1111-000000000003", name_fr: "Rosso", name_ar: "روصو" },
  { id: "11111111-1111-1111-1111-000000000004", name_fr: "Boghé", name_ar: "بوغي" },
  { id: "11111111-1111-1111-1111-000000000005", name_fr: "Kaédi", name_ar: "كيهيدي" },
  { id: "11111111-1111-1111-1111-000000000002", name_fr: "Nouadhibou", name_ar: "نواذيبو" },
  { id: "11111111-1111-1111-1111-000000000006", name_fr: "Kiffa", name_ar: "كيفة" },
  { id: "11111111-1111-1111-1111-000000000007", name_fr: "Atar", name_ar: "أطار" },
  { id: "11111111-1111-1111-1111-000000000008", name_fr: "Aleg", name_ar: "ألاك" },
];
