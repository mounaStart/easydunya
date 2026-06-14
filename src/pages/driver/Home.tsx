import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Payment, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import { formatPrice, formatPeriod, relativeDateLabel } from "../../lib/utils";

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function DriverHome() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const isAr = i18n.language === "ar";

  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [pendingByTrip, setPendingByTrip] = useState<Record<string, number>>({});
  const [todayEarnings, setTodayEarnings] = useState(0);
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

      const ids = allTrips.length > 0 ? allTrips.map((tr) => tr.id) : ["x"];
      const { data: bookingsData } = await supabase
        .from("bookings")
        .select("status, trip_id")
        .in("trip_id", ids);

      const pendingMap: Record<string, number> = {};
      for (const b of bookingsData ?? []) {
        if (b.status === "pending") {
          pendingMap[b.trip_id as string] =
            (pendingMap[b.trip_id as string] ?? 0) + 1;
        }
      }

      const { data: payData } = await supabase
        .from("payments")
        .select("driver_earning, paid_at")
        .eq("driver_id", user.id)
        .eq("status", "paid");
      const today = (payData as Payment[] | null ?? []).reduce(
        (sum, p) => (isToday(p.paid_at) ? sum + p.driver_earning : sum),
        0
      );

      if (!cancelled) {
        setTrips(allTrips);
        setPendingByTrip(pendingMap);
        setTodayEarnings(today);
        setLoading(false);
      }
    }

    load();
    const channel = supabase
      .channel(`driver-home-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        if (!cancelled) load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) return <Spinner />;

  // Garde d'accès (compte non approuvé) : on renvoie vers le tableau de bord qui gère ces états
  if (profile?.role === "driver" && profile.driver_status !== "approved") {
    return <DriverStatusNotice status={profile.driver_status} />;
  }

  const now = Date.now();
  const activeTrip = trips.find((tr) => tr.status === "in_progress") ?? null;
  const nextTrip =
    trips
      .filter((tr) => tr.status === "scheduled" && new Date(tr.depart_at).getTime() >= now)
      .sort((a, b) => new Date(a.depart_at).getTime() - new Date(b.depart_at).getTime())[0] ??
    null;
  const totalPending = Object.values(pendingByTrip).reduce((a, b) => a + b, 0);
  const todayTripsCount = trips.filter((tr) => isToday(tr.depart_at)).length;
  const firstName = (profile?.full_name ?? "").split(/\s+/)[0] ?? "";
  const route = (tr: TripPublic) =>
    `${isAr ? tr.from_name_ar : tr.from_name_fr} → ${isAr ? tr.to_name_ar : tr.to_name_fr}`;

  return (
    <div className="page max-w-2xl space-y-5">
      {/* En-tête de bienvenue */}
      <div>
        <h1 className="h1">
          {t("driver.greeting")}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="muted">{t("driver.greetingSub")}</p>
      </div>

      {/* Carte d'action principale */}
      {activeTrip ? (
        <Link
          to={`/driver/trips/${activeTrip.id}/bookings`}
          className="card p-5 flex items-center gap-4 bg-brand-50 border-brand-200 hover:shadow-md transition"
        >
          <span className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-2xl shrink-0">
            🚗
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-brand-800">{t("driver.activeTripTitle")}</div>
            <div className="text-sm text-brand-700 truncate">{route(activeTrip)}</div>
            <div className="text-xs text-brand-600 mt-0.5">{t("driver.activeTripDesc")}</div>
          </div>
          <span className="btn-primary text-sm shrink-0">{t("driver.manageTrip")}</span>
        </Link>
      ) : (
        <Link
          to="/driver/trips/new"
          className="card p-5 flex items-center gap-4 hover:shadow-md transition"
          style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" }}
        >
          <span className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center text-3xl shrink-0">
            +
          </span>
          <div className="min-w-0 flex-1 text-white">
            <div className="font-bold text-lg">{t("driver.publishCtaTitle")}</div>
            <div className="text-sm text-white/85">{t("driver.publishCtaDesc")}</div>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rtl:rotate-180"><path d="M9 6l6 6-6 6"/></svg>
        </Link>
      )}

      {/* Bandeau « Aujourd'hui » */}
      <div className="grid grid-cols-3 gap-3">
        <MiniTile
          icon="💰"
          label={t("driver.todayEarnings")}
          value={formatPrice(todayEarnings)}
          tone="emerald"
        />
        <MiniTile
          icon="🕒"
          label={t("driver.nextDeparture")}
          value={nextTrip ? formatPeriod(nextTrip.depart_at) : "—"}
          tone="brand"
        />
        <MiniTile
          icon="🔔"
          label={t("driver.pendingTotal")}
          value={String(totalPending)}
          tone="amber"
        />
      </div>

      {/* Prochain voyage */}
      <div>
        <h2 className="h2 mb-2">{t("driver.nextTripTitle")}</h2>
        {nextTrip ? (
          <Link
            to={`/driver/trips/${nextTrip.id}/bookings`}
            className="card p-4 block hover:shadow-md transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="chip">{relativeDateLabel(nextTrip.depart_at)}</span>
                <div className="font-semibold text-ink mt-1 truncate">{route(nextTrip)}</div>
                <div className="muted">
                  {formatPeriod(nextTrip.depart_at)} ·{" "}
                  {t("driver.seatsSold", {
                    sold: nextTrip.seats_total - nextTrip.seats_available,
                    total: nextTrip.seats_total,
                  })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-brand-700">{formatPrice(nextTrip.price_per_seat)}</div>
                {(pendingByTrip[nextTrip.id] ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-xs font-bold">
                    {pendingByTrip[nextTrip.id]} {t("driver.pendingRequests")}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ) : (
          <div className="card p-6 text-center text-slate-500">{t("driver.noNextTrip")}</div>
        )}
      </div>

      {/* Raccourcis */}
      <div>
        <h2 className="h2 mb-2">{t("driver.quickActions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ShortcutTile to="/driver/trips/new" icon="➕" label={t("driver.newTripTitle")} />
          <ShortcutTile to="/driver/earnings" icon="💰" label={t("driver.earningsTitle")} />
          <ShortcutTile to="/driver/historique" icon="🕘" label={t("nav.historique")} />
          <ShortcutTile to="/driver/vehicles" icon="🚙" label={t("driver.myVehicles")} />
        </div>
      </div>

      {/* Lien tableau de bord complet */}
      <Link
        to="/driver"
        className="card p-4 flex items-center justify-between hover:shadow-md transition"
      >
        <span className="font-semibold text-ink">{t("driver.seeDashboard")}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 rtl:rotate-180"><path d="M9 6l6 6-6 6"/></svg>
      </Link>

      {/* Encart info commission */}
      <div className="card p-4 bg-slate-50 flex items-start gap-3">
        <span className="text-xl shrink-0">ℹ️</span>
        <div>
          <div className="font-semibold text-ink text-sm">{t("driver.commissionTipTitle")}</div>
          <p className="text-sm text-slate-600">{t("driver.commissionTipDesc")}</p>
        </div>
      </div>
    </div>
  );
}

function MiniTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "emerald" | "brand" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
        ? "text-amber-600"
        : "text-brand-700";
  return (
    <div className="card p-3 text-center">
      <div className="text-lg">{icon}</div>
      <div className={`font-bold mt-0.5 leading-tight ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ShortcutTile({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="card p-4 flex flex-col items-center justify-center gap-1.5 text-center hover:shadow-md transition"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-slate-700 leading-tight">{label}</span>
    </Link>
  );
}

function DriverStatusNotice({ status }: { status: string | null }) {
  const map: Record<string, { emoji: string; title: string; desc: string; bg: string }> = {
    pending: {
      emoji: "⏳",
      title: "Compte en attente de validation",
      desc: "Votre compte chauffeur est en cours de vérification par l'équipe Easy Dunya.",
      bg: "bg-amber-50 border-amber-200",
    },
    rejected: {
      emoji: "❌",
      title: "Compte refusé",
      desc: "Votre demande de compte chauffeur a été refusée. Contactez Easy Dunya.",
      bg: "bg-rose-50 border-rose-200",
    },
    suspended: {
      emoji: "⏸",
      title: "Compte suspendu",
      desc: "Votre compte chauffeur est temporairement suspendu. Contactez Easy Dunya.",
      bg: "bg-slate-100 border-slate-200",
    },
  };
  const info = map[status ?? "pending"] ?? map.pending;
  return (
    <div className="page max-w-xl">
      <div className={`card p-6 text-center ${info.bg}`}>
        <div className="text-4xl mb-2">{info.emoji}</div>
        <h1 className="h2 mb-2">{info.title}</h1>
        <p className="text-slate-600">{info.desc}</p>
      </div>
    </div>
  );
}
