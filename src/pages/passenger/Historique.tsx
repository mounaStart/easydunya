import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useMyBookings } from "../../hooks/useBookings";
import { supabase } from "../../lib/supabase";
import type { TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { formatPrice, formatTime, relativeDateLabel } from "../../lib/utils";

export default function Historique() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { user } = useAuth();
  const { bookings, loading } = useMyBookings(user?.id);
  const [trips, setTrips] = useState<Record<string, TripPublic>>({});

  useEffect(() => {
    if (bookings.length === 0) return;
    const ids = Array.from(new Set(bookings.map((b) => b.trip_id)));
    supabase
      .from("trips_public")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, TripPublic> = {};
        (data as TripPublic[] | null)?.forEach((tp) => (map[tp.id] = tp));
        setTrips(map);
      });
  }, [bookings]);

  if (!user) {
    return (
      <div className="page max-w-md">
        <div className="card p-8 text-center space-y-4">
          <p className="text-slate-500">{t("reservation.loginPrompt")}</p>
          <Link to="/login" className="btn-primary w-full">
            {t("auth.signIn")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page max-w-2xl">
      <h1 className="h1 mb-5">{t("nav.historique")}</h1>

      {loading ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("common.noResults")}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const trip = trips[b.trip_id];
            return (
              <Link
                key={b.id}
                to={trip ? `/trips/${trip.id}` : "#"}
                className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="code-display font-bold text-brand-700">
                      {b.confirmation_code}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  {trip && (
                    <>
                      <div className="font-semibold text-ink mt-1 flex items-center gap-1.5">
                        {isAr ? trip.from_name_ar : trip.from_name_fr}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        {isAr ? trip.to_name_ar : trip.to_name_fr}
                      </div>
                      <div className="muted">
                        {relativeDateLabel(trip.depart_at)} · {formatTime(trip.depart_at)} · {formatPrice(trip.price_per_seat * b.seats)}
                      </div>
                    </>
                  )}
                </div>
                <div className="text-right text-sm text-slate-500 shrink-0">
                  {b.seats} × {t("common.seats").toLowerCase()}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
