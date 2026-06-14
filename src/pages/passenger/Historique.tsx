import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useMyBookings } from "../../hooks/useBookings";
import { supabase } from "../../lib/supabase";
import type { BookingStatus, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { formatPrice, formatPeriod, relativeDateLabel } from "../../lib/utils";

type StatusFilter = "all" | BookingStatus;
type PeriodFilter = "all" | "week" | "month";
type SortOrder = "newest" | "oldest";

export default function Historique() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { user } = useAuth();
  const { bookings, loading } = useMyBookings(user?.id);
  const [trips, setTrips] = useState<Record<string, TripPublic>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

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

  const filtered = useMemo(() => {
    let list = [...bookings];
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (periodFilter !== "all") {
      const ms = periodFilter === "week" ? 7 * 86400000 : 30 * 86400000;
      const cutoff = Date.now() - ms;
      list = list.filter((b) => new Date(b.created_at).getTime() >= cutoff);
    }
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [bookings, statusFilter, periodFilter, sort]);

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
      <h1 className="h1 mb-4">{t("nav.historique")}</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="input text-sm py-2 w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">{t("historique.allStatus")}</option>
          <option value="pending">{t("booking.status.pending")}</option>
          <option value="confirmed">{t("booking.status.confirmed")}</option>
          <option value="completed">{t("booking.status.completed")}</option>
          <option value="cancelled">{t("booking.status.cancelled")}</option>
          <option value="rejected">{t("booking.status.rejected")}</option>
        </select>
        <select
          className="input text-sm py-2 w-auto"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
        >
          <option value="all">{t("historique.allPeriod")}</option>
          <option value="week">{t("driver.period.week")}</option>
          <option value="month">{t("driver.period.month")}</option>
        </select>
        <select
          className="input text-sm py-2 w-auto"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
        >
          <option value="newest">{t("historique.newest")}</option>
          <option value="oldest">{t("historique.oldest")}</option>
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("common.noResults")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
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
                    {b.is_waiting && (
                      <span className="text-xs text-amber-700">{t("booking.waitingList")}</span>
                    )}
                  </div>
                  {trip && (
                    <>
                      <div className="font-semibold text-ink mt-1">
                        {isAr ? trip.from_name_ar : trip.from_name_fr} →{" "}
                        {isAr ? trip.to_name_ar : trip.to_name_fr}
                      </div>
                      <div className="muted">
                        {relativeDateLabel(trip.depart_at)} · {formatPeriod(trip.depart_at)} ·{" "}
                        {formatPrice(trip.price_per_seat * b.seats)}
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
