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
  formatPeriod,
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
  const [pendingByTrip, setPendingByTrip] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      if (!user) return;

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

      // Revenus = NET réel encaissé (après commission Easy Dunya), via la table payments
      const { data: payData } = await supabase
        .from("payments")
        .select("driver_earning")
        .eq("driver_id", user.id)
        .eq("status", "paid");
      const earnings = (payData as { driver_earning: number }[] | null ?? []).reduce(
        (sum, p) => sum + (p.driver_earning ?? 0),
        0
      );

      let upcoming = 0;
      const pendingMap: Record<string, number> = {};
      for (const b of bookingsData ?? []) {
        const trip = allTrips.find((tr) => tr.id === b.trip_id);
        if (!trip) continue;
        if (b.status === "pending") {
          upcoming++;
          pendingMap[b.trip_id as string] =
            (pendingMap[b.trip_id as string] ?? 0) + 1;
        }
      }
      const tripsCount = allTrips.filter(
        (t) => t.status === "completed"
      ).length;

      if (!cancelled) {
        setTrips(allTrips);
        setStats({ earnings, tripsCount, upcoming });
        setPendingByTrip(pendingMap);
        setLoading(false);
      }
    }
    load();

    // Rafraîchissement temps réel : nouvelles réservations / changements
    const channel = supabase
      .channel(`driver-dashboard-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => {
          if (!cancelled) load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <Spinner />;

  // Garde d'accès selon le statut chauffeur
  if (profile?.role === "driver") {
    if (profile.driver_status === "pending") {
      return (
        <div className="page max-w-xl">
          <div className="card p-6 text-center bg-amber-50 border-amber-200">
            <div className="text-4xl mb-2">⏳</div>
            <h1 className="h2 mb-2">Compte en attente de validation</h1>
            <p className="text-slate-600 mb-2">
              Votre compte chauffeur est en cours de vérification par l'équipe
              Easy Dunya.
            </p>
            <p className="muted text-sm">
              Vous serez notifié dès qu'il sera approuvé. Vous pourrez alors
              publier vos voyages.
            </p>
          </div>
        </div>
      );
    }
    if (profile.driver_status === "rejected") {
      return (
        <div className="page max-w-xl">
          <div className="card p-6 text-center bg-rose-50 border-rose-200">
            <div className="text-4xl mb-2">❌</div>
            <h1 className="h2 mb-2">Compte refusé</h1>
            <p className="text-slate-600">
              Votre demande de compte chauffeur a été refusée. Contactez Easy
              Dunya pour plus d'informations.
            </p>
            <a href="mailto:contact@easydunya.mr" className="btn-primary inline-flex mt-4">
              📧 Nous contacter
            </a>
          </div>
        </div>
      );
    }
    if (profile.driver_status === "suspended") {
      return (
        <div className="page max-w-xl">
          <div className="card p-6 text-center bg-slate-100 border-slate-200">
            <div className="text-4xl mb-2">⏸</div>
            <h1 className="h2 mb-2">Compte suspendu</h1>
            <p className="text-slate-600">
              Votre compte chauffeur est temporairement suspendu. Contactez Easy
              Dunya pour réactiver votre accès.
            </p>
            <a href="mailto:contact@easydunya.mr" className="btn-primary inline-flex mt-4">
              📧 Nous contacter
            </a>
          </div>
        </div>
      );
    }
  }

  const activeTrip = trips.find((tr) => tr.status === "in_progress") ?? null;
  const totalPending = Object.values(pendingByTrip).reduce((a, b) => a + b, 0);
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0] ?? "";

  return (
    <div className="page">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="h1">
            {t("driver.greeting")}{firstName ? `, ${firstName}` : ""} 👋
          </h1>
          <p className="muted">{t("driver.greetingSub")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/driver/earnings" className="btn-secondary text-sm">
            💰 {t("driver.earningsTitle")}
          </Link>
          <Link to="/driver/historique" className="btn-secondary text-sm">
            {t("nav.historique")}
          </Link>
          <Link to="/driver/trips/new" className="btn-primary">
            + {t("driver.newTripTitle")}
          </Link>
        </div>
      </div>

      {/* Bannière voyage en cours */}
      {activeTrip && (
        <Link
          to={`/driver/trips/${activeTrip.id}/bookings`}
          className="card p-4 mb-5 flex items-center gap-3 bg-brand-50 border-brand-200 hover:shadow-md transition"
        >
          <span className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl shrink-0">
            🚗
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-brand-800">{t("driver.activeTripTitle")}</div>
            <div className="text-sm text-brand-700 truncate">
              {(i18n.language === "ar" ? activeTrip.from_name_ar : activeTrip.from_name_fr)} →{" "}
              {(i18n.language === "ar" ? activeTrip.to_name_ar : activeTrip.to_name_fr)}
            </div>
          </div>
          <span className="btn-primary text-sm shrink-0">{t("driver.manageActiveTrip")}</span>
        </Link>
      )}

      {/* Demandes à traiter (mise en avant) */}
      {totalPending > 0 && !activeTrip && (
        <div className="card p-4 mb-5 flex items-center gap-3 bg-amber-50 border-amber-200">
          <span className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shrink-0">
            🔔
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-amber-900">
              {totalPending} {t("driver.pendingRequests")}
            </div>
            <div className="text-sm text-amber-700">{t("driver.pendingTotal")}</div>
          </div>
        </div>
      )}

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
            const pending = pendingByTrip[trip.id] ?? 0;
            return (
              <Link
                key={trip.id}
                to={`/driver/trips/${trip.id}/bookings`}
                className="card p-4 block hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
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
                      {formatPeriod(trip.depart_at)} ·{" "}
                      {trip.seats_available}/{trip.seats_total}{" "}
                      {t("common.seatsAvailable")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-brand-700">
                      {formatPrice(trip.price_per_seat)}
                    </div>
                    <div className="text-xs text-slate-500">
                      /{t("common.seats").toLowerCase()}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>
                    {t("driver.manageBookings")}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 6l6 6-6 6"/></svg>
                  </span>
                  {pending > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-700 px-3 py-1 text-xs font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {pending} {t("driver.pendingRequests")}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">
                      {t("driver.noPending")}
                    </span>
                  )}
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
