import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import type { DriverStatus, Profile } from "../../lib/types";
import Spinner from "../../components/Spinner";
import { formatNumber, formatPrice } from "../../lib/utils";

interface Stats {
  users: number;
  drivers: number;
  trips: number;
  bookings: number;
  revenue: number; // commission 6%
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [usersRes, driversRes, tripsRes, bookingsRes, revenueRes, pendingRes] =
      await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "driver"),
        supabase.from("trips").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        // Estimation simple : somme price * seats des réservations confirmées
        supabase
          .from("bookings")
          .select("seats, trip_id, trips!inner(price_per_seat)")
          .in("status", ["confirmed", "completed"]),
        supabase
          .from("profiles")
          .select("*")
          .eq("role", "driver")
          .eq("driver_status", "pending"),
      ]);

    type RevenueRow = {
      seats: number;
      trips: { price_per_seat: number } | null;
    };
    const revenueRows = (revenueRes.data as RevenueRow[] | null) ?? [];
    const gross = revenueRows.reduce(
      (acc, r) => acc + (r.trips?.price_per_seat ?? 0) * r.seats,
      0
    );

    setStats({
      users: usersRes.count ?? 0,
      drivers: driversRes.count ?? 0,
      trips: tripsRes.count ?? 0,
      bookings: bookingsRes.count ?? 0,
      revenue: Math.round(gross * 0.06),
    });
    setPending((pendingRes.data as Profile[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setDriverStatus(id: string, status: DriverStatus) {
    await supabase
      .from("profiles")
      .update({ driver_status: status })
      .eq("id", id);
    load();
  }

  if (loading || !stats) return <Spinner />;

  return (
    <div className="page">
      <h1 className="h1 mb-5">{t("admin.dashboard")}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <Stat label={t("admin.stats.users")} value={formatNumber(stats.users)} />
        <Stat label={t("admin.stats.drivers")} value={formatNumber(stats.drivers)} />
        <Stat label={t("admin.stats.trips")} value={formatNumber(stats.trips)} />
        <Stat label={t("admin.stats.bookings")} value={formatNumber(stats.bookings)} />
        <Stat
          label={t("admin.stats.revenue")}
          value={formatPrice(stats.revenue)}
          highlight
        />
      </div>

      <h2 className="h2 mb-3">{t("admin.pendingDrivers")}</h2>
      {pending.length === 0 ? (
        <div className="card p-6 text-center text-slate-500">
          {t("admin.noPending")}
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((d) => (
            <div
              key={d.id}
              className="card p-4 flex items-center justify-between flex-wrap gap-2"
            >
              <div>
                <div className="font-semibold">{d.full_name ?? "—"}</div>
                <div className="muted">{d.phone ?? ""}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setDriverStatus(d.id, "approved")}
                  className="btn-primary text-sm"
                >
                  ✓ {t("admin.approveDriver")}
                </button>
                <button
                  onClick={() => setDriverStatus(d.id, "rejected")}
                  className="btn-ghost text-rose-700 text-sm"
                >
                  ✕ {t("admin.rejectDriver")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`card p-4 ${
        highlight ? "bg-brand-600 text-white border-brand-600" : ""
      }`}
    >
      <div
        className={`text-xs uppercase tracking-wide ${
          highlight ? "text-brand-50/80" : "text-slate-500"
        }`}
      >
        {label}
      </div>
      <div className={`text-xl sm:text-2xl font-bold mt-1`}>{value}</div>
    </div>
  );
}
