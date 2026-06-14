import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { cancelTripWithBroadcast } from "../../hooks/useBookings";
import type { TripPublic, TripStatus } from "../../lib/types";
import Spinner from "../../components/Spinner";
import {
  formatPrice,
  formatPeriod,
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
    const reason = prompt(
      "Motif d'annulation (optionnel) — les autres chauffeurs vers la même destination seront notifiés :"
    );
    if (reason === null) return;
    if (!confirm("Confirmer l'annulation de ce voyage ?")) return;
    const { error, notified } = await cancelTripWithBroadcast(id, reason || undefined);
    if (error) {
      alert(error);
      return;
    }
    if (notified && notified > 0) {
      alert(`${notified} chauffeur(s) notifié(s) pour redistribution.`);
    }
    load();
  }

  async function endTrip(id: string) {
    if (!confirm("Terminer ce voyage maintenant ? (action administrateur)")) return;
    const { error } = await supabase.rpc("driver_end_trip", { p_trip_id: id });
    if (error) {
      alert(error.message);
      return;
    }
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
                    <span>{relativeDateLabel(t.depart_at)} · {formatPeriod(t.depart_at)}</span>
                    <span>👤 {t.driver_name ?? "—"}</span>
                    <span>{formatPrice(t.price_per_seat)}/place</span>
                    <span>{t.seats_available}/{t.seats_total} dispo</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.status === "in_progress" && (
                    <button
                      onClick={() => endTrip(t.id)}
                      className="btn-secondary text-xs"
                    >
                      ■ Terminer
                    </button>
                  )}
                  {(t.status === "scheduled" || t.status === "in_progress") && (
                    <button
                      onClick={() => cancelTrip(t.id)}
                      className="btn-ghost text-rose-700 text-xs"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
