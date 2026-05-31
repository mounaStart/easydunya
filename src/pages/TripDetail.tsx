import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrip } from "../hooks/useTrips";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";
import { formatPrice, formatTime, relativeDateLabel } from "../lib/utils";

export default function TripDetail() {
  const { tripId } = useParams();
  const { trip, loading } = useTrip(tripId);
  const { t, i18n } = useTranslation();

  if (loading) return <Spinner />;
  if (!trip) {
    return (
      <div className="page">
        <p className="card p-6 text-center text-slate-500">
          {t("common.noResults")}
        </p>
      </div>
    );
  }

  const isAr = i18n.language === "ar";
  const fromName = isAr ? trip.from_name_ar : trip.from_name_fr;
  const toName = isAr ? trip.to_name_ar : trip.to_name_fr;
  const noSeats = trip.seats_available <= 0;

  return (
    <div className="page max-w-2xl">
      <Link to="/" className="text-sm text-brand-700 hover:underline">
        ← {t("common.back")}
      </Link>

      <div className="card p-6 mt-3">
        <div className="flex items-center justify-between mb-4">
          <span className="chip">{relativeDateLabel(trip.depart_at)}</span>
          <StatusBadge status={trip.status} kind="trip" />
        </div>

        <h1 className="h1 leading-tight">
          {fromName}
          <span className="mx-2 text-brand-500">→</span>
          {toName}
        </h1>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <Info label={t("common.time")} value={formatTime(trip.depart_at)} />
          <Info
            label={t("common.price")}
            value={formatPrice(trip.price_per_seat)}
          />
          <Info
            label={t("common.seatsAvailable")}
            value={`${trip.seats_available} / ${trip.seats_total}`}
          />
          <Info label={t("trip.driver")} value={trip.driver_name ?? "—"} />
          {trip.vehicle_label && (
            <Info
              label={t("trip.vehicle")}
              value={`${trip.vehicle_label} · ${trip.vehicle_plate ?? ""}`}
            />
          )}
          {trip.driver_rating !== null && trip.driver_rating !== undefined && (
            <Info
              label="★"
              value={`${Number(trip.driver_rating).toFixed(1)} (${trip.driver_rating_count})`}
            />
          )}
        </div>

        {trip.notes && (
          <div className="mt-5 bg-sand-50 border border-sand-100 rounded-xl p-4 text-sm text-slate-700">
            <div className="font-semibold mb-1">{t("trip.notes")}</div>
            {trip.notes}
          </div>
        )}

        <div className="mt-6">
          {noSeats ? (
            <button disabled className="btn-primary w-full">
              {t("booking.noSeats")}
            </button>
          ) : (
            <Link to={`/trips/${trip.id}/book`} className="btn-primary w-full">
              {t("trip.bookSeat")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2.5">
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
