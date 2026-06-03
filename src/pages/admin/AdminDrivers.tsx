import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DriverAdmin, DriverStatus } from "../../lib/types";
import Spinner from "../../components/Spinner";

type FilterId = "all" | "pending" | "approved" | "rejected" | "suspended";

const FILTERS: Array<{ id: FilterId; label: string; color: string }> = [
  { id: "pending", label: "En attente", color: "bg-amber-100 text-amber-700" },
  { id: "approved", label: "Approuvés", color: "bg-emerald-100 text-emerald-700" },
  { id: "rejected", label: "Refusés", color: "bg-rose-100 text-rose-700" },
  { id: "suspended", label: "Suspendus", color: "bg-slate-200 text-slate-700" },
  { id: "all", label: "Tous", color: "bg-brand-100 text-brand-700" },
];

interface Props {
  onMutate?: () => void;
}

export default function AdminDrivers({ onMutate }: Props) {
  const [filter, setFilter] = useState<FilterId>("pending");
  const [drivers, setDrivers] = useState<DriverAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let q = supabase
      .from("drivers_admin")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("driver_status", filter);

    const { data, error } = await q;
    if (error) {
      // Fallback : si la vue drivers_admin n'existe pas, on charge depuis profiles seul
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "driver")
        .order("created_at", { ascending: false });
      const mapped =
        (p ?? []).map((row: Record<string, unknown>) => ({
          ...(row as object),
          email: "",
          last_sign_in_at: null,
          trips_total: 0,
          vehicles_total: 0,
        })) as unknown as DriverAdmin[];
      setDrivers(
        filter === "all"
          ? mapped
          : mapped.filter((d) => d.driver_status === filter)
      );
      setError(
        "ℹ Vue drivers_admin non disponible. Exécutez supabase/migrations/0003_admin_stats.sql."
      );
    } else {
      setDrivers((data as DriverAdmin[]) ?? []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(d: DriverAdmin, status: DriverStatus) {
    if (
      (status === "rejected" || status === "suspended") &&
      !confirm(`Confirmer "${status}" pour ${d.full_name ?? d.email} ?`)
    ) {
      return;
    }
    setBusyId(d.id);
    setError(null);
    setSuccessMsg(null);

    // RPC sécurisée (migration 0005) — contourne les blocages RLS
    const { error: rpcErr } = await supabase.rpc("admin_set_driver_status", {
      p_driver_id: d.id,
      p_status: status,
    });

    if (rpcErr) {
      const rpcMissing =
        rpcErr.code === "PGRST202" ||
        rpcErr.message.toLowerCase().includes("could not find");

      if (rpcMissing) {
        const { data, error: updErr } = await supabase
          .from("profiles")
          .update({ driver_status: status })
          .eq("id", d.id)
          .select("id");

        if (updErr) {
          setError(updErr.message);
          setBusyId(null);
          return;
        }
        if (!data || data.length === 0) {
          setError(
            "Mise à jour bloquée (RLS). Exécutez supabase/migrations/0005_fix_admin_rls.sql dans Supabase SQL Editor."
          );
          setBusyId(null);
          return;
        }
      } else {
        const msg = rpcErr.message.includes("forbidden")
          ? "Permission refusée : vérifiez que votre compte a role = admin dans la table profiles."
          : rpcErr.message;
        setError(msg);
        setBusyId(null);
        return;
      }
    }

    const labels: Record<DriverStatus, string> = {
      approved: "approuvé",
      rejected: "refusé",
      suspended: "suspendu",
      pending: "en attente",
    };
    setSuccessMsg(
      `${d.full_name ?? d.email} — statut : ${labels[status] ?? status}`
    );
    setBusyId(null);
    await load();
    onMutate?.();
    setTimeout(() => setSuccessMsg(null), 4000);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f.id
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto btn-ghost text-sm"
          title="Rafraîchir"
        >
          ⟳
        </button>
      </div>

      {successMsg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg mb-3">
          ✓ {successMsg}
        </p>
      )}

      {error && (
        <p className="text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg mb-3">
          {error}
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : drivers.length === 0 ? (
        <div className="text-center text-slate-500 py-8">
          Aucun chauffeur dans cette catégorie.
        </div>
      ) : (
        <div className="space-y-2">
          {drivers.map((d) => {
            const status = d.driver_status ?? "pending";
            const statusClass =
              FILTERS.find((f) => f.id === status)?.color ??
              "bg-slate-100 text-slate-700";

            return (
              <div
                key={d.id}
                className="border border-slate-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">
                      {d.full_name ?? d.email ?? "—"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass}`}
                    >
                      {status}
                    </span>
                    {d.rating_avg !== null && d.rating_count > 0 && (
                      <span className="text-xs text-amber-600">
                        ★ {Number(d.rating_avg).toFixed(1)} ({d.rating_count})
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                    {d.phone && (
                      <a href={`tel:${d.phone}`} className="hover:text-brand-700">
                        📞 {d.phone}
                      </a>
                    )}
                    {d.email && (
                      <a href={`mailto:${d.email}`} className="hover:text-brand-700">
                        ✉ {d.email}
                      </a>
                    )}
                    <span>🛣 {d.trips_total ?? 0} voyages</span>
                    <span>🚗 {d.vehicles_total ?? 0} véhicules</span>
                  </div>
                  {(d.license_number || d.base_city_name) && (
                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap mt-1.5 pt-1.5 border-t border-slate-50">
                      {d.license_number && (
                        <span>🪪 Permis: <span className="font-mono">{d.license_number}</span></span>
                      )}
                      {d.base_city_name && (
                        <span>📍 Base: {d.base_city_name}</span>
                      )}
                      <span className="text-slate-400">
                        Inscrit le {new Date(d.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {status === "pending" && (
                    <>
                      <button
                        onClick={() => setStatus(d, "approved")}
                        disabled={busyId === d.id}
                        className="btn-primary text-sm"
                      >
                        ✓ Approuver
                      </button>
                      <button
                        onClick={() => setStatus(d, "rejected")}
                        disabled={busyId === d.id}
                        className="btn-ghost text-rose-700 text-sm"
                      >
                        ✕ Refuser
                      </button>
                    </>
                  )}
                  {status === "approved" && (
                    <button
                      onClick={() => setStatus(d, "suspended")}
                      disabled={busyId === d.id}
                      className="btn-ghost text-amber-700 text-sm"
                    >
                      ⏸ Suspendre
                    </button>
                  )}
                  {(status === "rejected" || status === "suspended") && (
                    <button
                      onClick={() => setStatus(d, "approved")}
                      disabled={busyId === d.id}
                      className="btn-secondary text-sm"
                    >
                      ↻ Réactiver
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
