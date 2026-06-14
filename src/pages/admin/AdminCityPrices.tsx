import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { useCities } from "../../hooks/useCities";
import { useCityPrices, computeCommission } from "../../hooks/useCityPrices";
import { formatPrice } from "../../lib/utils";
import Spinner from "../../components/Spinner";

export default function AdminCityPrices() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { cities } = useCities();
  const { prices, loading, refresh } = useCityPrices();

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [price, setPrice] = useState(5000);
  const [distance, setDistance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const cityName = (id: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? (isAr ? c.name_ar : c.name_fr) : "—";
  };

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    cities.forEach((c) => (m[c.id] = isAr ? c.name_ar : c.name_fr));
    return m;
  }, [cities, isAr]);

  function reset() {
    setFromId("");
    setToId("");
    setPrice(5000);
    setDistance(0);
    setEditId(null);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!fromId || !toId) return setError("Sélectionnez les deux villes.");
    if (fromId === toId) return setError("Les villes doivent être différentes.");
    if (price <= 0) return setError("Prix invalide.");
    setBusy(true);
    const payload = {
      from_city_id: fromId,
      to_city_id: toId,
      price_per_seat: price,
      distance_km: distance,
    };
    const { error } = editId
      ? await supabase.from("city_prices").update(payload).eq("id", editId)
      : await supabase.from("city_prices").upsert(payload, {
          onConflict: "from_city_id,to_city_id",
        });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    reset();
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce tarif ?")) return;
    await supabase.from("city_prices").delete().eq("id", id);
    refresh();
  }

  return (
    <div>
      <div className="border border-brand-100 bg-brand-50/40 rounded-xl p-4 mb-4">
        <h3 className="font-bold text-ink mb-3">
          {editId ? "Modifier le tarif" : "Ajouter un tarif"}
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ville de départ</label>
            <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{nameById[c.id]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ville d'arrivée</label>
            <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{nameById[c.id]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Prix par siège (MRU)</label>
            <input type="number" min={1} className="input" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Distance (km)</label>
            <input type="number" min={0} className="input" value={distance} onChange={(e) => setDistance(Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Commission EasyDunya estimée / siège :{" "}
          <strong>{formatPrice(computeCommission(distance, price, 1))}</strong>{" "}
          ({distance >= 100 ? "≥ 100 km → 100 MRU fixe" : "< 100 km → prix d'un siège"})
        </p>
        {error && <p className="text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={save} disabled={busy} className="btn-primary flex-1">
            {busy ? "…" : editId ? "Enregistrer" : "Ajouter"}
          </button>
          {editId && (
            <button onClick={reset} className="btn-secondary">Annuler</button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : prices.length === 0 ? (
        <div className="text-center text-slate-500 py-8">Aucun tarif enregistré.</div>
      ) : (
        <div className="space-y-2">
          {prices.map((p) => (
            <div key={p.id} className="border border-slate-100 rounded-xl p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink">
                  {cityName(p.from_city_id)} → {cityName(p.to_city_id)}
                </div>
                <div className="text-sm text-slate-500">
                  {formatPrice(p.price_per_seat)} · {Number(p.distance_km)} km · commission/siège{" "}
                  {formatPrice(computeCommission(Number(p.distance_km), p.price_per_seat, 1))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    setEditId(p.id);
                    setFromId(p.from_city_id);
                    setToId(p.to_city_id);
                    setPrice(p.price_per_seat);
                    setDistance(Number(p.distance_km));
                  }}
                  className="btn-ghost text-sm"
                >
                  ✎
                </button>
                <button onClick={() => remove(p.id)} className="btn-ghost text-rose-700 text-sm">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
