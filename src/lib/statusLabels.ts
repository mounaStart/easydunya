import type { BookingStatus, DriverStatus, TripStatus, UserRole } from "./types";

/** Libellés FR fixes — affichage admin même si i18n / Netlify pas à jour. */
export const DRIVER_STATUS_FR: Record<DriverStatus, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export const TRIP_STATUS_FR: Record<TripStatus, string> = {
  scheduled: "Programmé",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

export const BOOKING_STATUS_FR: Record<BookingStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  rejected: "Refusée",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const USER_ROLE_FR: Record<UserRole, string> = {
  admin: "Administrateur",
  driver: "Chauffeur",
  passenger: "Passager",
};

export function labelDriverStatus(
  status: DriverStatus | string | null | undefined,
  t?: (key: string) => string
): string {
  const key = (status ?? "pending") as DriverStatus;
  if (t) {
    const translated = t(`driver.status.${key}`);
    if (translated && !translated.startsWith("driver.status.")) return translated;
  }
  return DRIVER_STATUS_FR[key] ?? String(status);
}

export function labelTripStatus(status: TripStatus, t?: (key: string) => string): string {
  if (t) {
    const translated = t(`trip.status.${status}`);
    if (translated && !translated.startsWith("trip.status.")) return translated;
  }
  return TRIP_STATUS_FR[status] ?? status;
}

export function labelUserRole(role: UserRole, t?: (key: string) => string): string {
  if (t) {
    const translated = t(`admin.roles.${role}`);
    if (translated && !translated.startsWith("admin.roles.")) return translated;
  }
  return USER_ROLE_FR[role] ?? role;
}
