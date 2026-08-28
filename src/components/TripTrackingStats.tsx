import { useTranslation } from "react-i18next";
import type { TripPublic } from "../lib/types";
import { distanceKm, formatDistance, tripTotalDistanceKm } from "../lib/utils";

interface Props {
  trip: TripPublic;
  driverPos: { lat: number; lng: number } | null;
  started: boolean;
  className?: string;
}

/** Distance totale + distance restante (comme côté chauffeur). */
export default function TripTrackingStats({
  trip,
  driverPos,
  started,
  className = "",
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? "ar-MR" : "fr-FR";

  const totalKm = tripTotalDistanceKm(trip);
  const remainingM =
    started &&
    driverPos &&
    Number.isFinite(trip.to_lat) &&
    Number.isFinite(trip.to_lng)
      ? distanceKm(driverPos.lat, driverPos.lng, trip.to_lat, trip.to_lng) * 1000
      : null;

  if (totalKm == null && remainingM == null) return null;

  const totalLabel =
    totalKm != null
      ? `${Number(totalKm).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
      : null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>
      {totalLabel && (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 text-brand-800 px-3 py-1.5 text-xs font-semibold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          {t("trip.totalDistance")}: {totalLabel}
        </span>
      )}
      {remainingM != null && (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-semibold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {t("trip.remainingToDestination", {
            distance: formatDistance(remainingM, i18n.language),
          })}
        </span>
      )}
    </div>
  );
}
