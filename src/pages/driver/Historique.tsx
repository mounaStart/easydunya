import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { TripPublic, TripStatus } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import { formatPrice, formatPeriod, relativeDateLabel } from "../../lib/utils";

type StatusFilter = "all" | TripStatus;
type PeriodFilter = "all" | "week" | "month";

export default function DriverHistorique() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("trips_public")
      .select("*")
      .eq("driver_id", user.id)
      .order("depart_at", { ascending: false })
      .then(({ data }) => {
        setTrips((data as TripPublic[] | null) ?? []);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    let list = trips.filter(
      (tr) => tr.status === "completed" || tr.status === "cancelled"
    );
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (periodFilter !== "all") {
      const ms = periodFilter === "week" ? 7 * 86400000 : 30 * 86400000;
      const cutoff = Date.now() - ms;
      list = list.filter((t) => new Date(t.depart_at).getTime() >= cutoff);
    }
    return list;
  }, [trips, statusFilter, periodFilter]);

  return (
    <div className="page max-w-2xl">
      <h1 className="h1 mb-1">{t("nav.historique")}</h1>
      <p className="muted mb-4">{t("driver.historiqueSub")}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="input text-sm py-2 w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">{t("historique.allStatus")}</option>
          <option value="completed">{t("trip.status.completed")}</option>
          <option value="cancelled">{t("trip.status.cancelled")}</option>
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
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">{t("common.noResults")}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((trip) => (
            <Link
              key={trip.id}
              to={`/driver/trips/${trip.id}/bookings`}
              className="card p-4 block hover:shadow-md transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={trip.status} kind="trip" />
                <span className="chip">{relativeDateLabel(trip.depart_at)}</span>
              </div>
              <div className="font-semibold text-ink">
                {isAr ? trip.from_name_ar : trip.from_name_fr} →{" "}
                {isAr ? trip.to_name_ar : trip.to_name_fr}
              </div>
              <div className="muted">
                {formatPeriod(trip.depart_at)} · {formatPrice(trip.price_per_seat)}/place
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
