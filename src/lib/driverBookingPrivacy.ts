import type { Booking, Profile } from "./types";

/** Le chauffeur ne voit le contact qu'après confirmation de la réservation. */
export function driverCanSeePassengerContact(
  booking: Pick<Booking, "status">
): boolean {
  return booking.status === "confirmed" || booking.status === "completed";
}

export function driverPassengerPhone(
  booking: Booking,
  profile?: Profile | null
): string | null {
  if (!driverCanSeePassengerContact(booking)) return null;
  return booking.guest_phone ?? profile?.phone ?? null;
}
