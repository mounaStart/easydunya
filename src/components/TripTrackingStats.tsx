import { useTranslation } from "react-i18next";
import type { TripPublic } from "../lib/types";
import { formatDistance } from "../lib/utils";
import { useDrivingRoute, useTripRemainingDistance } from "../hooks/useDrivingRoute";

interface Props {
  trip: TripPublic;
  driverPos: { lat: number; lng: number } | null;
  started: boolean;
  className?: string;
}

/** Distance totale + distance restante sur la route (Google Maps). */
export default function TripTrackingStats({
  trip,
  driverPos,
  started,
  className = "",
}: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const locale = isAr ? "ar-MR" : "fr-FR";

  const from =
    Number.isFinite(trip.from_lat) && Number.isFinite(trip.from_lng)
      ? { lat: trip.from_lat, lng: trip.from_lng }
      : null;
  const to =
    Number.isFinite(trip.to_lat) && Number.isFinite(trip.to_lng)
      ? { lat: trip.to_lat, lng: trip.to_lng }
      : null;

  const driver = started && driverPos ? driverPos : null;

  const { distanceM: totalRouteM, loading: totalLoading } = useDrivingRoute(from, to, !!from && !!to, {
    precision: 4,
  });

  const { remainingM, loading: remainingLoading } = useTripRemainingDistance(
    from,
    to,
    driver,
    started && !!driver && !!from && !!to
  );

  const totalKm =
    totalRouteM != null ? totalRouteM / 1000 : trip.distance_km != null ? Number(trip.distance_km) : null;

  if (totalKm == null && remainingM == null && !totalLoading && !remainingLoading) return null;

  const totalLabel =
    totalKm != null
      ? `${Number(totalKm).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
      : totalLoading
        ? "…"
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
      {(remainingM != null || remainingLoading) && (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-semibold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {remainingLoading
            ? t("trip.remainingLoading")
            : t("trip.remainingToDestination", {
                distance: formatDistance(remainingM ?? 0, i18n.language),
              })}
        </span>
      )}
    </div>
  );
}
