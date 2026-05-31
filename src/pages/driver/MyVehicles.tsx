import { useEffect, useState, type FormEvent } from "react";
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
  const [showForm, setShowForm] = useState(false);

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(8);
  const [features, setFeatures] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("vehicles")
      .select("*")
      .eq("driver_id", user.id)
      .order("created_at", { ascending: false });
    setVehicles((data as Vehicle[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    await supabase.from("vehicles").insert({
      driver_id: user.id,
      make,
      model,
      plate,
      seats,
      features: features || null,
    });
    setBusy(false);
    setShowForm(false);
    setMake("");
    setModel("");
    setPlate("");
    setSeats(8);
    setFeatures("");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce véhicule ?")) return;
    await supabase.from("vehicles").delete().eq("id", id);
    load();
  }

  return (
    <div className="page max-w-3xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h1 className="h1">{t("driver.myVehicles")}</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          + {t("driver.addVehicle")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">{t("driver.make")}</label>
              <input
                className="input"
                required
                value={make}
                onChange={(e) => setMake(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("driver.model")}</label>
              <input
                className="input"
                required
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
            <div>
              <label className="label">{t("driver.plate")}</label>
              <input
                className="input uppercase"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <label className="label">{t("common.seats")}</label>
              <input
                type="number"
                className="input"
                required
                min={1}
                max={60}
                value={seats}
                onChange={(e) => setSeats(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="label">{t("driver.features")}</label>
            <input
              className="input"
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="Climatisé, bagages, etc."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-ghost"
            >
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : vehicles.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("driver.noVehicles")}
        </div>
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => (
            <div key={v.id} className="card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">
                  {v.make} {v.model}{" "}
                  <span className="text-slate-400">· {v.plate}</span>
                </div>
                <div className="muted">
                  {v.seats} {t("common.seats").toLowerCase()}
                  {v.features ? ` · ${v.features}` : ""}
                </div>
              </div>
              <button
                onClick={() => handleDelete(v.id)}
                className="btn-ghost text-rose-600 text-sm"
              >
                {t("common.delete")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
