import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TripPublic } from "../lib/types";
import { formatPrice, formatTime, relativeDateLabel } from "../lib/utils";

interface Props {
  trip: TripPublic;
}

export default function TripCard({ trip }: Props) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const fromName = isAr ? trip.from_name_ar : trip.from_name_fr;
  const toName = isAr ? trip.to_name_ar : trip.to_name_fr;
  const date = relativeDateLabel(trip.depart_at);
  const time = formatTime(trip.depart_at);

  return (
    <Link
      to={`/trips/${trip.id}`}
      className="card p-4 sm:p-5 block hover:shadow-md transition group"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="chip">{date}</span>
        <span className="text-sm font-semibold text-brand-700">
          {formatPrice(trip.price_per_seat)}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg font-bold text-slate-900">{fromName}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" className="text-brand-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {isAr ? <path d="M19 12H5M11 18l-6-6 6-6" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
        </svg>
        <span className="text-lg font-bold text-slate-900">{toName}</span>
      </div>

      <div className="text-sm text-slate-500 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {time}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          {trip.seats_available} {t("common.seatsAvailable")}
        </span>
        {trip.driver_name && (
          <span className="inline-flex items-center gap-1">
            <span className="text-amber-500">★</span>
            {trip.driver_rating
              ? `${Number(trip.driver_rating).toFixed(1)} · ${trip.driver_name}`
              : trip.driver_name}
          </span>
        )}
      </div>

      {trip.notes && (
        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{trip.notes}</p>
      )}
    </Link>
  );
}
