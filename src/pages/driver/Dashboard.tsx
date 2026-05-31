import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import {
  formatNumber,
  formatPrice,
  formatTime,
  relativeDateLabel,
} from "../../lib/utils";

interface Stats {
  earnings: number;
  tripsCount: number;
  upcoming: number;
}

export default function DriverDashboard() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [stats, setStats] = useState<Stats>({ earnings: 0, tripsCount: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      if (!user) return;
      setLoading(true);

      const { data: tripsData } = await supabase
        .from("trips_public")
        .select("*")
        .eq("driver_id", user.id)
        .order("depart_at", { ascending: true });

      const allTrips = (tripsData as TripPublic[] | null) ?? [];

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("seats, status, trip_id")
        .in(
          "trip_id",
          allTrips.length > 0 ? allTrips.map((t) => t.id) : ["00000000-0000-0000-0000-000000000000"]
        );

      let earnings = 0;
      let upcoming = 0;
      for (const b of bookingsData ?? []) {
        const trip = allTrips.find((tr) => tr.id === b.trip_id);
        if (!trip) continue;
        if (b.status === "confirmed" || b.status === "completed") {
          earnings += (trip.price_per_seat as number) * (b.seats as number);
        }
        if (b.status === "pending") upcoming++;
      }
      const tripsCount = allTrips.filter(
        (t) => t.status === "completed"
      ).length;

      if (!cancelled) {
        setTrips(allTrips);
        setStats({ earnings, tripsCount, upcoming });
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <Spinner />;

  if (profile?.driver_status === "pending") {
    return (
      <div className="page max-w-xl">
        <div className="card p-6 text-center bg-amber-50 border-amber-200">
          <div className="text-3xl mb-2">⏳</div>
          <h1 className="h2 mb-2">{t("auth.driverPending")}</h1>
          <p className="muted">Easy Dunya</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h1 className="h1">{t("driver.dashboard")}</h1>
        <Link to="/driver/trips/new" className="btn-primary">
          + {t("driver.newTripTitle")}
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label={t("driver.earnings")}
          value={formatPrice(stats.earnings)}
          color="text-emerald-600"
        />
        <StatCard
          label={t("driver.tripsCount")}
          value={formatNumber(stats.tripsCount)}
          color="text-brand-700"
        />
        <StatCard
          label={t("driver.upcoming")}
          value={formatNumber(stats.upcoming)}
          color="text-amber-600"
        />
        <StatCard
          label={t("driver.ratingAvg")}
          value={
            profile?.rating_avg
              ? `${Number(profile.rating_avg).toFixed(1)} ★`
              : "—"
          }
          color="text-yellow-600"
        />
      </div>

      <h2 className="h2 mb-3">{t("nav.myTrips")}</h2>
      {trips.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-500 mb-4">{t("driver.noTrips")}</p>
          <Link to="/driver/trips/new" className="btn-primary inline-flex">
            {t("driver.publishFirst")}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const isAr = i18n.language === "ar";
            return (
              <Link
                key={trip.id}
                to={`/driver/trips/${trip.id}/bookings`}
                className="card p-4 flex items-center justify-between gap-3 hover:shadow-md transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={trip.status} kind="trip" />
                    <span className="chip">
                      {relativeDateLabel(trip.depart_at)}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 mt-1">
                    {(isAr ? trip.from_name_ar : trip.from_name_fr)} →{" "}
                    {(isAr ? trip.to_name_ar : trip.to_name_fr)}
                  </div>
                  <div className="muted">
                    {formatTime(trip.depart_at)} ·{" "}
                    {trip.seats_available}/{trip.seats_total}{" "}
                    {t("common.seatsAvailable")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-700">
                    {formatPrice(trip.price_per_seat)}
                  </div>
                  <div className="text-xs text-slate-500">
                    /{t("common.seats").toLowerCase()}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">
        {label}
      </div>
      <div className={`text-xl sm:text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
