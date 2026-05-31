import i18n from "i18next";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatPrice(amount: number, currency = "MRU"): string {
  try {
    return new Intl.NumberFormat(i18n.language === "ar" ? "ar-MR" : "fr-FR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
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
