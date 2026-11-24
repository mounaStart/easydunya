import i18n from "i18next";
import { APP_TIME_ZONE, civilDateInTimeZone } from "./tripSchedule";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Date du jour en Mauritanie (YYYY-MM-DD) — min pour les champs date. */
export function isoToday(): string {
  return civilDateInTimeZone(new Date());
}

/** Devise affichée (ouguiya mauritanien — MRU). */
export const CURRENCY_LABEL = "MRU";

export function formatPrice(amount: number): string {
  const formatted = new Intl.NumberFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${CURRENCY_LABEL}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR").format(n);
}

/** Renvoie "Aujourd'hui", "Demain" ou la date complète (jour civil Mauritanie). */
export function relativeDateLabel(date: Date | string, lang = i18n.language): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const today = civilDateInTimeZone(new Date());
  const target = civilDateInTimeZone(d);
  const diffDays = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000
  );

  if (diffDays === 0) return lang === "ar" ? "اليوم" : "Aujourd'hui";
  if (diffDays === 1) return lang === "ar" ? "غدًا" : "Demain";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-MR" : "fr-FR", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function formatTime(date: Date | string, lang = i18n.language): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-MR" : "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Période de la journée : matin (avant 12h) ou soir (12h et après). */
export function dayPeriod(date: Date | string): "morning" | "evening" {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getHours() < 12 ? "morning" : "evening";
}

/** Période de la journée à partir d'une heure "HH:MM" (input local). */
export function dayPeriodFromHour(hour: number): "morning" | "evening" {
  return hour < 12 ? "morning" : "evening";
}

/** Libellé traduit de la période (Matin / Soir) au lieu de l'heure exacte. */
export function formatPeriod(date: Date | string): string {
  return i18n.t(`common.${dayPeriod(date)}`);
}

/** Distance en km entre deux points GPS (formule de Haversine). */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // rayon Terre (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Affiche une distance lisible : "350 m" ou "2,3 km". */
export function formatDistance(meters: number, lang = i18n.language): string {
  if (meters < 1000) {
    const m = Math.round(meters);
    return lang === "ar" ? `${m} م` : `${m} m`;
  }
  const km = meters / 1000;
  const formatted = new Intl.NumberFormat(lang === "ar" ? "ar-MR" : "fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: km < 10 ? 1 : 0,
  }).format(km);
  return lang === "ar" ? `${formatted} كم` : `${formatted} km`;
}

/** Distance totale d'un trajet (BDD ou repli Haversine — préférer useTripRouteDistanceKm). */
export function tripTotalDistanceKm(trip: {
  distance_km?: number | null;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
}): number | null {
  if (trip.distance_km != null && Number(trip.distance_km) > 0) {
    return Number(trip.distance_km);
  }
  if (
    Number.isFinite(trip.from_lat) &&
    Number.isFinite(trip.from_lng) &&
    Number.isFinite(trip.to_lat) &&
    Number.isFinite(trip.to_lng)
  ) {
    return distanceKm(trip.from_lat!, trip.from_lng!, trip.to_lat!, trip.to_lng!);
  }
  return null;
}

export function shareViaWhatsApp(text: string) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
