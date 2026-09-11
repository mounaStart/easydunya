import type { TripPublic } from "./types";

const ACTIVE_STATUSES = new Set<TripPublic["status"]>(["scheduled", "in_progress"]);

/** Voyage actif ou programmé non terminé. */
export function filterActiveTrips(trips: TripPublic[]): TripPublic[] {
  return trips.filter((t) => ACTIVE_STATUSES.has(t.status));
}

export function hasActiveDriverTrip(trips: TripPublic[]): boolean {
  return filterActiveTrips(trips).length > 0;
}

/** Priorité : en cours, sinon le prochain programmé. */
export function pickPrimaryActiveTrip(trips: TripPublic[]): TripPublic | null {
  const active = filterActiveTrips(trips);
  const inProgress = active.find((t) => t.status === "in_progress");
  if (inProgress) return inProgress;
  return (
    [...active].sort(
      (a, b) => new Date(a.depart_at).getTime() - new Date(b.depart_at).getTime()
    )[0] ?? null
  );
}

export function driverBookingsPath(tripId: string): string {
  return `/driver/trips/${tripId}/bookings`;
}
