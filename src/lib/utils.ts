import i18n from "i18next";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Date locale du jour (YYYY-MM-DD) — min pour les champs date passager. */
export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatPrice(amount: number): string {
  const formatted = new Intl.NumberFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} MRU`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR").format(n);
}

/** Renvoie "Aujourd'hui", "Demain" ou la date complète. */
export function relativeDateLabel(date: Date | string, lang = i18n.language): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) return lang === "ar" ? "اليوم" : "Aujourd'hui";
  if (diffDays === 1) return lang === "ar" ? "غدًا" : "Demain";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-MR" : "fr-FR", {
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
