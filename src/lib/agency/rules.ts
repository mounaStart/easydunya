import { lastStopIndex, tripStops } from "./trip";
import type {
  Agency,
  AgencyBooking,
  AgencyChannel,
  AgencyDB,
  AgencyTrip,
} from "./types";

export function isActiveBooking(b: AgencyBooking): boolean {
  return b.status === "attente" || b.status === "confirmee" || b.status === "terminee";
}

/** Une place est occupée sur les tronçons [fromIdx, toIdx). */
export function bookingOccupiesSegment(b: AgencyBooking, seg: number): boolean {
  return isActiveBooking(b) && b.fromIdx <= seg && b.toIdx > seg;
}

export function occupiedOnSegment(db: AgencyDB, tripId: string, seg: number): Set<number> {
  const taken = new Set<number>();
  for (const b of db.bookings) {
    if (b.tripId !== tripId || !bookingOccupiesSegment(b, seg)) continue;
    for (const n of b.seatNos) taken.add(n);
  }
  return taken;
}

/** Places occupées sur au moins un tronçon entre montée et descente. */
export function occupiedOnLegs(
  db: AgencyDB,
  tripId: string,
  fromIdx: number,
  toIdx: number
): Set<number> {
  const taken = new Set<number>();
  for (let seg = fromIdx; seg < toIdx; seg++) {
    for (const n of occupiedOnSegment(db, tripId, seg)) taken.add(n);
  }
  return taken;
}

/** Compat : places occupées sur tout le trajet (tronçon le plus chargé, union). */
export function occupiedSeatNos(db: AgencyDB, tripId: string): number[] {
  const trip = db.trips.find((t) => t.id === tripId);
  const last = trip ? lastStopIndex(trip) : 1;
  return [...occupiedOnLegs(db, tripId, 0, last)];
}

/** Places libres affichées = places − occupation du tronçon le plus chargé. */
export function freeSeatCount(db: AgencyDB, trip: AgencyTrip): number {
  const last = lastStopIndex(trip);
  let minFree = trip.seats;
  for (let seg = 0; seg < last; seg++) {
    minFree = Math.min(minFree, trip.seats - occupiedOnSegment(db, trip.id, seg).size);
  }
  return Math.max(0, minFree);
}

export function freeOnLegs(db: AgencyDB, trip: AgencyTrip, fromIdx: number, toIdx: number): number {
  return Math.max(0, trip.seats - occupiedOnLegs(db, trip.id, fromIdx, toIdx).size);
}

export function hasAnyFreeSeat(db: AgencyDB, trip: AgencyTrip): boolean {
  const last = lastStopIndex(trip);
  for (let seg = 0; seg < last; seg++) {
    if (trip.seats - occupiedOnSegment(db, trip.id, seg).size > 0) return true;
  }
  return last === 0;
}

export function seatsByChannel(
  db: AgencyDB,
  tripId: string
): Record<AgencyChannel | "libre", number> {
  const trip = db.trips.find((t) => t.id === tripId);
  const counts: Record<AgencyChannel | "libre", number> = {
    app: 0,
    guichet: 0,
    sous: 0,
    libre: trip ? freeSeatCount(db, trip) : 0,
  };
  if (!trip) return counts;
  const last = lastStopIndex(trip);
  const seen: Record<AgencyChannel, Set<number>> = {
    app: new Set(),
    guichet: new Set(),
    sous: new Set(),
  };
  for (const b of db.bookings) {
    if (b.tripId !== tripId || !isActiveBooking(b)) continue;
    for (const n of b.seatNos) seen[b.channel].add(n);
  }
  counts.app = seen.app.size;
  counts.guichet = seen.guichet.size;
  counts.sous = seen.sous.size;
  void last;
  return counts;
}

export function occupancyBySegment(db: AgencyDB, trip: AgencyTrip): Array<{
  from: string;
  to: string;
  occupied: number;
  free: number;
}> {
  const stops = tripStops(trip);
  const rows = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const occ = occupiedOnSegment(db, trip.id, stops[i].index).size;
    rows.push({
      from: stops[i].city,
      to: stops[i + 1].city,
      occupied: occ,
      free: Math.max(0, trip.seats - occ),
    });
  }
  return rows;
}

export type TripDisplayStatus = "ouvert" | "presque" | "complet" | "selon" | "termine" | "annule";

export function tripDisplayStatus(db: AgencyDB, trip: AgencyTrip): TripDisplayStatus {
  if (trip.status === "annule") return "annule";
  if (new Date(trip.departAt).getTime() < Date.now()) return "termine";
  const last = lastStopIndex(trip);
  const frees: number[] = [];
  for (let seg = 0; seg < last; seg++) {
    frees.push(Math.max(0, trip.seats - occupiedOnSegment(db, trip.id, seg).size));
  }
  const minFree = Math.min(...frees);
  const maxFree = Math.max(...frees);
  if (minFree <= 0 && maxFree > 0) return "selon";
  if (minFree <= 0) return "complet";
  if (minFree <= 3) return "presque";
  return "ouvert";
}

export function refundForCancel(
  agency: Agency,
  trip: AgencyTrip,
  booking: AgencyBooking
): {
  refund: number;
  pay: AgencyBooking["pay"];
} {
  if (booking.pay !== "paye") {
    return { refund: 0, pay: booking.pay === "a_payer" ? "sans" : booking.pay };
  }
  const hoursLeft = (new Date(trip.departAt).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft >= agency.cancelHours) {
    return { refund: booking.total, pay: "rembourse" };
  }
  const refund = Math.round(booking.total * (1 - agency.cancelFee / 100));
  return { refund, pay: "rembourse_partiel" };
}

export function hasPerm(staff: { role: string; perms: string[] }, perm: string): boolean {
  if (staff.role === "admin") return true;
  return staff.perms.includes(perm);
}

export function firstFreeSeats(
  db: AgencyDB,
  trip: AgencyTrip,
  n: number,
  fromIdx = 0,
  toIdx?: number
): number[] {
  const to = toIdx ?? lastStopIndex(trip);
  const taken = occupiedOnLegs(db, trip.id, fromIdx, to);
  const out: number[] = [];
  for (let i = 1; i <= trip.seats && out.length < n; i++) {
    if (!taken.has(i)) out.push(i);
  }
  return out;
}

export function sameDay(aIso: string, bIso: string): boolean {
  return aIso.slice(0, 10) === bIso.slice(0, 10);
}

export const DISPLAY_STATUS_LABEL: Record<TripDisplayStatus, string> = {
  ouvert: "Ouvert",
  presque: "Presque complet",
  complet: "Complet",
  selon: "Selon trajet",
  termine: "Terminé",
  annule: "Annulé",
};
