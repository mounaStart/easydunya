import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { useCities } from "../../hooks/useCities";
import { useCityPrices } from "../../hooks/useCityPrices";
import { getCurrentPosition, reverseQuartier } from "../../lib/geocode";
import { distanceKm, formatPrice } from "../../lib/utils";
import type { Vehicle } from "../../lib/types";

// Heures par défaut associées aux périodes (le passager ne voit que Matin/Soir)
const MORNING_HOUR = 8;
const EVENING_HOUR = 18;

export default function NewTrip() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const { cities } = useCities();
  const { prices } = useCityPrices();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [fromCityId, setFromCityId] = useState("");
  const [toCityId, setToCityId] = useState("");
  const [departDate, setDepartDate] = useState(defaultDate());
  const [period, setPeriod] = useState<"morning" | "evening">("morning");
  const [price, setPrice] = useState(5000);
  const [seats, setSeats] = useState(8);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Point de départ GPS du chauffeur (pour "voyage le plus proche")
  const [departPos, setDepartPos] = useState<{ lat: number; lng: number } | null>(null);
  const [departQuartier, setDepartQuartier] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);

  async function captureDeparture() {
    setGeoErr(null);
    setGeoBusy(true);
    try {
      const pos = await getCurrentPosition();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setDepartPos({ lat, lng });
      const q = await reverseQuartier(lat, lng);
      setDepartQuartier(q);
    } catch {
      setGeoErr(t("driver.departGpsError"));
    } finally {
      setGeoBusy(false);
    }
  }

  // Nombre de places max = capacité du véhicule (défini à la création du compte).
  // Le chauffeur peut diminuer mais pas dépasser cette capacité.
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;
  const maxSeats = selectedVehicle ? selectedVehicle.seats : 60;

  // Tarif officiel pour la paire de villes sélectionnée
  const cityPrice =
    fromCityId && toCityId
      ? prices.find(
          (p) => p.from_city_id === fromCityId && p.to_city_id === toCityId
        ) ?? null
      : null;

  // Pré-remplit automatiquement le prix officiel quand il existe
  useEffect(() => {
    if (cityPrice) setPrice(cityPrice.price_per_seat);
  }, [cityPrice]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("is_driver_locked", { p_driver_id: user.id }).then(({ data }) => {
      setLocked(data === true);
    });
  }, [user, profile?.current_trip_id]);

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

    // La date choisie + la période (matin/soir) déterminent l'heure de départ
    const [y, m, d] = departDate.split("-").map(Number);
    const hour = period === "morning" ? MORNING_HOUR : EVENING_HOUR;
    const departDateTime = new Date(y, (m ?? 1) - 1, d ?? 1, hour, 0, 0);

    // Distance : tarif officiel sinon calcul Haversine sur les coordonnées des villes
    const fromCity = cities.find((c) => c.id === fromCityId);
    const toCity = cities.find((c) => c.id === toCityId);
    const computedDistance =
      fromCity && toCity
        ? Math.round(
            distanceKm(
              fromCity.latitude,
              fromCity.longitude,
              toCity.latitude,
              toCity.longitude
            )
          )
        : null;

    const { error } = await supabase.from("trips").insert({
      driver_id: user.id,
      vehicle_id: vehicleId || null,
      from_city_id: fromCityId,
      to_city_id: toCityId,
      depart_at: departDateTime.toISOString(),
      price_per_seat: price,
      seats_total: seats,
      seats_available: seats,
      notes: notes || null,
      status: "scheduled",
      city_price_id: cityPrice?.id ?? null,
      distance_km: cityPrice?.distance_km ?? computedDistance,
      depart_lat: departPos?.lat ?? null,
      depart_lng: departPos?.lng ?? null,
      depart_quartier: departQuartier,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/driver");
  }

  if (locked) {
    return (
      <div className="page max-w-xl">
        <h1 className="h1 mb-5">{t("driver.newTripTitle")}</h1>
        <div className="card p-6 text-center bg-amber-50 border-amber-200">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="h2 mb-2">{t("driver.lockedTitle")}</h2>
          <p className="text-slate-600 mb-4">{t("driver.lockedHint")}</p>
          <Link to="/driver" className="btn-primary">{t("nav.dashboard")}</Link>
        </div>
      </div>
    );
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t("driver.departDate")}</label>
            <input
              type="date"
              className="input"
              required
              value={departDate}
              onChange={(e) => setDepartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("driver.departPeriod")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeriod("morning")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3.5 font-semibold transition ${
                  period === "morning"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span>☀️</span>
                {t("common.morning")}
              </button>
              <button
                type="button"
                onClick={() => setPeriod("evening")}
                className={`inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3.5 font-semibold transition ${
                  period === "evening"
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <span>🌙</span>
                {t("common.evening")}
              </button>
            </div>
          </div>
        </div>

        {/* Point de départ GPS — sert au "voyage le plus proche" côté passager */}
        <div>
          <label className="label">{t("driver.departPoint")}</label>
          <button
            type="button"
            onClick={captureDeparture}
            disabled={geoBusy}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 font-semibold transition ${
              departPos
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                : "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
            }`}
          >
            {geoBusy ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>
            ) : departPos ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            )}
            {geoBusy
              ? t("search.locating")
              : departPos
                ? t("driver.departPointSet")
                : t("driver.departPointBtn")}
          </button>
          {departPos && (
            <p className="text-xs text-emerald-700 mt-1.5">
              📍 {departQuartier ?? `${departPos.lat.toFixed(4)}, ${departPos.lng.toFixed(4)}`}
            </p>
          )}
          {!departPos && (
            <p className="text-xs text-slate-500 mt-1.5">{t("driver.departPointHint")}</p>
          )}
          {geoErr && (
            <p className="text-xs text-rose-600 mt-1.5">{geoErr}</p>
          )}
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
            {cityPrice ? (
              <p className="text-xs text-emerald-700 mt-1">
                ✓ {t("driver.officialPriceHint", {
                  price: formatPrice(cityPrice.price_per_seat),
                  km: Number(cityPrice.distance_km),
                })}
              </p>
            ) : (
              fromCityId &&
              toCityId && (
                <p className="text-xs text-amber-600 mt-1">
                  Aucun tarif officiel pour ce trajet — prix libre.
                </p>
              )
            )}
          </div>
          <div>
            <label className="label">{t("common.seats")}</label>
            <input
              type="number"
              className="input"
              required
              min={1}
              max={maxSeats}
              value={seats}
              onChange={(e) =>
                setSeats(Math.min(maxSeats, Math.max(1, Number(e.target.value))))
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              {t("driver.maxSeatsHint", { count: maxSeats })}
            </p>
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

function defaultDate() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
