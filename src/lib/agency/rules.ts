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

export function occupiedSeatNos(db: AgencyDB, tripId: string): number[] {
  return db.bookings
    .filter((b) => b.tripId === tripId && isActiveBooking(b))
    .flatMap((b) => b.seatNos);
}

export function freeSeatCount(db: AgencyDB, trip: AgencyTrip): number {
  const taken = new Set(occupiedSeatNos(db, trip.id));
  return Math.max(0, trip.seats - taken.size);
}

export function seatsByChannel(db: AgencyDB, tripId: string): Record<AgencyChannel | "libre", number> {
  const trip = db.trips.find((t) => t.id === tripId);
  const counts: Record<AgencyChannel | "libre", number> = {
    app: 0,
    guichet: 0,
    sous: 0,
    libre: trip ? trip.seats : 0,
  };
  for (const b of db.bookings) {
    if (b.tripId !== tripId || !isActiveBooking(b)) continue;
    counts[b.channel] += b.seats;
    counts.libre -= b.seats;
  }
  counts.libre = Math.max(0, counts.libre);
  return counts;
}

export function tripDisplayStatus(db: AgencyDB, trip: AgencyTrip): "ouvert" | "presque" | "complet" | "termine" | "annule" {
  if (trip.status === "annule") return "annule";
  if (new Date(trip.departAt).getTime() < Date.now()) return "termine";
  const free = freeSeatCount(db, trip);
  if (free <= 0) return "complet";
  if (free <= 3) return "presque";
  return "ouvert";
}

export function refundForCancel(agency: Agency, trip: AgencyTrip, booking: AgencyBooking): {
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

export function hasPerm(
  staff: { role: string; perms: string[] },
  perm: string
): boolean {
  if (staff.role === "admin") return true;
  return staff.perms.includes(perm);
}

export function firstFreeSeats(db: AgencyDB, trip: AgencyTrip, n: number): number[] {
  const taken = new Set(occupiedSeatNos(db, trip.id));
  const out: number[] = [];
  for (let i = 1; i <= trip.seats && out.length < n; i++) {
    if (!taken.has(i)) out.push(i);
  }
  return out;
}

export function sameDay(aIso: string, bIso: string): boolean {
  return aIso.slice(0, 10) === bIso.slice(0, 10);
}
