/** Fuseau métier Easy Dunya (Mauritanie = GMT toute l’année). */
export const APP_TIME_ZONE = "Africa/Nouakchott";

/** Date civile YYYY-MM-DD dans un fuseau (indépendant du navigateur). */
export function civilDateInTimeZone(date: Date, timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function departureCivilDate(iso: string): string {
  return civilDateInTimeZone(new Date(iso));
}

/** True si le jour prévu (Mauritanie) est déjà passé. */
export function isDepartureDatePassed(iso: string, now = new Date()): boolean {
  return departureCivilDate(iso) < civilDateInTimeZone(now);
}

/** Affichage jj/mm/aaaa du jour de départ en Mauritanie. */
export function formatDepartureDay(iso: string, lang = "fr"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(lang.startsWith("ar") ? "ar-MR" : "fr-FR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** Instant UTC pour une date choisie dans le calendrier (YYYY-MM-DD) + heure à Nouakchott. */
export function nouakchottDateTimeIso(dateYmd: string, hour: number, minute = 0): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateYmd}T${hh}:${mm}:00.000Z`;
}
