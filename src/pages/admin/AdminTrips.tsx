import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import type { TripPublic, TripStatus } from "../../lib/types";
import Spinner from "../../components/Spinner";
import {
  formatPrice,
  formatTime,
  relativeDateLabel,
} from "../../lib/utils";

type StatusFilter = "all" | TripStatus;

export default function AdminTrips() {
  const { i18n } = useTranslation();
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("trips_public")
      .select("*")
      .order("depart_at", { ascending: false })
      .limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setTrips((data as TripPublic[] | null) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelTrip(id: string) {
    if (!confirm("Annuler ce voyage ? Toutes les réservations resteront en base.")) return;
    await supabase.from("trips").update({ status: "cancelled" }).eq("id", id);
    load();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(
          [
            "all",
            "scheduled",
            "in_progress",
            "completed",
            "cancelled",
          ] as StatusFilter[]
        ).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "all" ? "Tous" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : trips.length === 0 ? (
        <div className="text-center text-slate-500 py-8">Aucun voyage.</div>
      ) : (
        <div className="space-y-2">
          {trips.map((t) => {
            const isAr = i18n.language === "ar";
            return (
              <div
                key={t.id}
                className="border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {(isAr ? t.from_name_ar : t.from_name_fr)}
                      <span className="mx-1 text-brand-500">→</span>
                      {(isAr ? t.to_name_ar : t.to_name_fr)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        t.status === "scheduled"
                          ? "bg-sky-100 text-sky-700"
                          : t.status === "in_progress"
                          ? "bg-amber-100 text-amber-700"
                          : t.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                    <span>{relativeDateLabel(t.depart_at)} · {formatTime(t.depart_at)}</span>
                    <span>👤 {t.driver_name ?? "—"}</span>
                    <span>{formatPrice(t.price_per_seat)}/place</span>
                    <span>{t.seats_available}/{t.seats_total} dispo</span>
                  </div>
                </div>
                {(t.status === "scheduled" || t.status === "in_progress") && (
                  <button
                    onClick={() => cancelTrip(t.id)}
                    className="btn-ghost text-rose-700 text-xs"
                  >
                    Annuler
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
