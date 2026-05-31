import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { useCities } from "../../hooks/useCities";
import type { Vehicle } from "../../lib/types";

export default function NewTrip() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cities } = useCities();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [fromCityId, setFromCityId] = useState("");
  const [toCityId, setToCityId] = useState("");
  const [departAt, setDepartAt] = useState(defaultDepart());
  const [price, setPrice] = useState(5000);
  const [seats, setSeats] = useState(8);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("vehicles")
      .select("*")
      .eq("driver_id", user.id)
      .then(({ data }) => {
        const list = (data as Vehicle[] | null) ?? [];
        setVehicles(list);
        if (list[0]) {
          setVehicleId(list[0].id);
          setSeats(list[0].seats);
        }
      });
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (fromCityId === toCityId) {
      setError("Les villes de départ et d'arrivée doivent être différentes.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("trips").insert({
      driver_id: user.id,
      vehicle_id: vehicleId || null,
      from_city_id: fromCityId,
      to_city_id: toCityId,
      depart_at: new Date(departAt).toISOString(),
      price_per_seat: price,
      seats_total: seats,
      seats_available: seats,
      notes: notes || null,
      status: "scheduled",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/driver");
  }

  return (
    <div className="page max-w-xl">
      <h1 className="h1 mb-5">{t("driver.newTripTitle")}</h1>

      {vehicles.length === 0 && (
        <p className="card p-4 mb-4 text-sm text-amber-800 bg-amber-50 border-amber-200">
          ⚠ {t("driver.noVehicles")}
        </p>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">{t("driver.selectVehicle")}</label>
          <select
            className="input"
            value={vehicleId}
            onChange={(e) => {
              const v = vehicles.find((x) => x.id === e.target.value);
              setVehicleId(e.target.value);
              if (v) setSeats(v.seats);
            }}
          >
            <option value="">—</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} · {v.plate} ({v.seats} {t("common.seats").toLowerCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("driver.fromCity")}</label>
            <select
              className="input"
              required
              value={fromCityId}
              onChange={(e) => setFromCityId(e.target.value)}
            >
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {i18n.language === "ar" ? c.name_ar : c.name_fr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("driver.toCity")}</label>
            <select
              className="input"
              required
              value={toCityId}
              onChange={(e) => setToCityId(e.target.value)}
            >
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {i18n.language === "ar" ? c.name_ar : c.name_fr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">{t("driver.departAt")}</label>
          <input
            type="datetime-local"
            className="input"
            required
            value={departAt}
            onChange={(e) => setDepartAt(e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">{t("common.price")} (MRU)</label>
            <input
              type="number"
              className="input"
              required
              min={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
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
          <label className="label">{t("trip.notes")}</label>
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Climatisé, bagages autorisés…"
          />
        </div>

        {error && (
          <p className="text-sm text-rose-700 bg-rose-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? t("common.loading") : t("driver.publish")}
        </button>
      </form>
    </div>
  );
}

function defaultDepart() {
  const d = new Date(Date.now() + 6 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}
