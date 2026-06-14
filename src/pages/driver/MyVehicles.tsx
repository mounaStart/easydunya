import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import type { Vehicle } from "../../lib/types";
import Spinner from "../../components/Spinner";

export default function MyVehicles() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("vehicles")
      .select("*")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setVehicles((data as Vehicle[] | null) ?? []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="page max-w-3xl">
      <h1 className="h1 mb-5">{t("driver.myVehicles")}</h1>

      {loading ? (
        <Spinner />
      ) : vehicles.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("driver.noVehicles")}
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-4 flex items-center gap-3">
              <span className="icon-tile-soft w-12 h-12 shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2v-3l2-5h12l2 5v3a2 2 0 0 1-2 2M7 17v2M17 17v2"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/></svg>
              </span>
              <div>
                <div className="font-semibold text-ink">
                  {v.make} {v.model ?? ""}{" "}
                  <span className="text-slate-400">· {v.plate}</span>
                </div>
                <div className="muted">
                  {v.seats} {t("common.seats").toLowerCase()}
                  {v.features ? ` · ${v.features}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
