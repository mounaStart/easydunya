import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invokeRpcWithAccessToken } from "../../lib/supabaseRpc";
import { restSelect } from "../../lib/supabaseRest";
import type { AdminStats } from "../../lib/types";
import { formatNumber, formatPrice } from "../../lib/utils";
import AdminTabs from "./AdminTabs";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await invokeRpcWithAccessToken("get_admin_stats", {});
    if (error) {
      console.warn("get_admin_stats RPC failed, fallback to client counts", error);
      const [u, d, dp, t, b, rev] = await Promise.all([
        restSelect<{ id: string }>("profiles", { select: "id" }),
        restSelect<{ id: string }>("profiles", { select: "id", eq: { role: "driver" } }),
        restSelect<{ id: string }>("profiles", {
          select: "id",
          eq: { role: "driver", driver_status: "pending" },
        }),
        restSelect<{ id: string }>("trips", { select: "id" }),
        restSelect<{ id: string }>("bookings", { select: "id" }),
        restSelect<{
          seats: number;
          trips: { price_per_seat: number } | { price_per_seat: number }[] | null;
        }>("bookings", {
          select: "seats,trips!inner(price_per_seat)",
          in: { status: ["confirmed", "completed"] },
        }),
      ]);
      const gross = rev.data.reduce((a, r) => {
        const trip = Array.isArray(r.trips) ? r.trips[0] : r.trips;
        return a + (trip?.price_per_seat ?? 0) * r.seats;
      }, 0);
      setStats({
        users_count: u.data.length,
        drivers_count: d.data.length,
        drivers_pending: dp.data.length,
        drivers_approved: 0,
        drivers_suspended: 0,
        passengers_count: 0,
        trips_count: t.data.length,
        trips_scheduled: 0,
        trips_in_progress: 0,
        trips_completed: 0,
        bookings_count: b.data.length,
        bookings_pending: 0,
        bookings_confirmed: 0,
        gross_revenue: gross,
        commission_revenue: gross * 0.06,
      });
      setError(
        "ℹ Performance dégradée : exécutez supabase/migrations/0003_admin_stats.sql dans Supabase pour un chargement rapide."
      );
    } else {
      setStats(data as AdminStats);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="page">
      <h1 className="h1 mb-1">{t("admin.dashboard")}</h1>
      <p className="muted mb-5">Easy Dunya · Vue d'ensemble</p>

      {/* Stats principales (skeleton si chargement) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Stat label={t("admin.stats.users")} value={stats ? formatNumber(stats.users_count) : "…"} loading={loading} icon="👥" />
        <Stat label={t("admin.stats.drivers")} value={stats ? formatNumber(stats.drivers_count) : "…"} loading={loading} icon="🚗" sub={stats ? `${stats.drivers_pending} en attente` : ""} />
        <Stat label={t("admin.stats.trips")} value={stats ? formatNumber(stats.trips_count) : "…"} loading={loading} icon="🛣" sub={stats ? `${stats.trips_scheduled} programmés` : ""} />
        <Stat label={t("admin.stats.bookings")} value={stats ? formatNumber(stats.bookings_count) : "…"} loading={loading} icon="🎟" sub={stats ? `${stats.bookings_pending} en attente` : ""} />
        <Stat label={t("admin.stats.revenue")} value={stats ? formatPrice(Math.round(stats.commission_revenue)) : "…"} loading={loading} icon="💰" sub={stats ? `Brut: ${formatPrice(Math.round(stats.gross_revenue))}` : ""} highlight />
      </div>

      {error && (
        <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-4">
          {error}
        </p>
      )}

      <AdminTabs onChange={load} />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
  icon,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  icon?: string;
  loading?: boolean;
}) {
  return (
    <div
      className={`card p-4 transition ${
        highlight ? "bg-brand-600 text-white border-brand-600" : ""
      } ${loading ? "animate-pulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`text-xs uppercase tracking-wide ${
            highlight ? "text-brand-50/80" : "text-slate-500"
          }`}
        >
          {label}
        </div>
        {icon && <span className="text-xl opacity-70">{icon}</span>}
      </div>
      <div className="text-xl sm:text-2xl font-bold mt-1">{value}</div>
      {sub && (
        <div
          className={`text-xs mt-0.5 ${
            highlight ? "text-brand-50/70" : "text-slate-400"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
