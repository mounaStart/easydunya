import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MapView from "../components/MapView";
import Spinner from "../components/Spinner";
import { useCities } from "../hooks/useCities";
import { useCityCounts, useUpcomingTrips } from "../hooks/useTrips";
import { distanceKm, formatPrice, formatPeriod, relativeDateLabel } from "../lib/utils";

type CityOption = { id: string; name_fr: string; name_ar: string };

export default function Home() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { cities } = useCities();
  const { cities: cityCounts } = useCityCounts();
  const { trips, loading, error: tripsError } = useUpcomingTrips({ days: 30 });

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState("");
  const [tab, setTab] = useState<"quick" | "map">("quick");

  const [searched, setSearched] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMode, setNearMode] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const cityName = (c: { name_fr: string; name_ar: string }) =>
    isAr ? c.name_ar : c.name_fr;

  // Paliers de rayon (km) : on commence à 10 km puis on élargit s'il n'y a rien
  const RADIUS_STEPS = [10, 25, 50, 100, 200, 500];

  const { items: results, radiusKm } = useMemo(() => {
    const filtered = trips.filter((tr) => {
      if (fromId && tr.from_city_id !== fromId) return false;
      if (toId && tr.to_city_id !== toId) return false;
      if (date) {
        const d = new Date(tr.depart_at);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (local !== date) return false;
      }
      return true;
    });

    const withDist = filtered.map((tr) => {
      // Point de départ effectif : GPS du chauffeur sinon centre-ville
      const dLat = tr.depart_lat ?? tr.from_lat;
      const dLng = tr.depart_lng ?? tr.from_lng;
      return {
        tr,
        dist:
          userPos && dLat != null && dLng != null
            ? distanceKm(userPos.lat, userPos.lng, dLat, dLng)
            : null,
      };
    });

    if (!nearMode || !userPos) {
      return { items: withDist, radiusKm: null as number | null };
    }

    // Tri par distance croissante
    withDist.sort((a, b) => {
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });

    // Trouve le plus petit rayon contenant au moins un voyage
    let chosen: number | null = null;
    for (const step of RADIUS_STEPS) {
      if (withDist.some((x) => x.dist != null && x.dist <= step)) {
        chosen = step;
        break;
      }
    }

    if (chosen == null) {
      // Aucun voyage géolocalisable dans 500 km : on montre tout, trié
      return { items: withDist, radiusKm: null as number | null };
    }

    const within = withDist.filter((x) => x.dist != null && x.dist <= chosen!);
    return { items: within, radiusKm: chosen };
  }, [trips, fromId, toId, date, nearMode, userPos]);

  const handleSearch = () => {
    setSearched(true);
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleNearest = () => {
    if (nearMode) {
      setNearMode(false);
      return;
    }
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError(t("search.geoUnavailable"));
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMode(true);
        setGeoLoading(false);
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? t("search.geoDenied")
            : t("search.geoUnavailable")
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="page max-w-2xl space-y-6">
      {/* Hero avec photo */}
      <div className="relative overflow-hidden rounded-3xl -mt-6 sm:-mt-2">
        <div
          className="absolute inset-0 bg-cover bg-[82%_center] sm:bg-center"
          style={{
            backgroundColor: "#cfe3f5",
            backgroundImage: "url('/brand/hero-passenger.png')",
          }}
        />
        {/* Léger voile en haut-gauche — l'image reste nette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(110% 80% at 0% 0%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 40%, transparent 58%)",
          }}
        />
        <div className="relative z-10 max-w-[50%] sm:max-w-md px-5 sm:px-8 pt-8 pb-24 sm:pb-28">
          <h1 className="text-[1.45rem] sm:text-4xl font-extrabold leading-tight [text-shadow:0_1px_12px_rgba(255,255,255,0.85)]">
            <span className="text-ink">{t("search.heroTitle1")}</span>
            <br />
            <span className="text-brand-600">{t("search.heroTitle2a")}</span>
            <span className="text-accent-500">{t("search.heroTitle2b")}</span>
          </h1>
          <p className="mt-3 text-[0.75rem] sm:text-base text-slate-600 leading-snug sm:leading-relaxed [text-shadow:0_1px_10px_rgba(255,255,255,0.9)]">
            <span className="md:hidden">{t("search.heroSubtitleShort")}</span>
            <span className="hidden md:inline">{t("search.heroSubtitle")}</span>
          </p>
        </div>
      </div>

      {/* Carte de recherche (chevauche le hero) */}
      <div className="card p-4 sm:p-6 -mt-20 sm:-mt-24 relative z-10 mx-0">
        {/* Onglets */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => setTab("quick")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
              tab === "quick" ? "text-white shadow-soft" : "text-slate-500"
            }`}
            style={tab === "quick" ? { backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" } : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            {t("search.tabQuick")}
          </button>
          <button
            type="button"
            onClick={() => setTab("map")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition ${
              tab === "map" ? "text-white shadow-soft" : "text-slate-500"
            }`}
            style={tab === "map" ? { backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" } : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/></svg>
            {t("search.tabMap")}
          </button>
        </div>

        {tab === "quick" ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">{t("search.fromCity")}</label>
                <CitySelect
                  value={fromId}
                  onChange={setFromId}
                  cities={cities}
                  cityName={cityName}
                  placeholder={t("search.selectCity")}
                />
              </div>
              <div>
                <label className="label">{t("search.toCity")}</label>
                <CitySelect
                  value={toId}
                  onChange={setToId}
                  cities={cities}
                  cityName={cityName}
                  placeholder={t("search.selectCity")}
                />
              </div>
            </div>

            <div>
              <label className="label">{t("search.tripDate")}</label>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="w-full py-4 rounded-2xl text-white font-bold inline-flex items-center justify-center gap-2 shadow-soft active:scale-[0.99] transition"
              style={{ backgroundImage: "linear-gradient(90deg,#1e88d6,#f97316)" }}
              onClick={handleSearch}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              {t("search.searchBtn")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <MapView
              cities={cityCounts}
              selectedCityId={fromId || null}
              onSelectCity={(id) => setFromId(id ?? "")}
              legend
              height={280}
            />
            <p className="muted text-sm">{t("search.mapHint")}</p>
            <button
              type="button"
              className="w-full py-4 rounded-2xl text-white font-bold inline-flex items-center justify-center gap-2 shadow-soft active:scale-[0.99] transition"
              style={{ backgroundImage: "linear-gradient(90deg,#1e88d6,#f97316)" }}
              onClick={handleSearch}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              {t("search.searchBtn")}
            </button>
          </div>
        )}
      </div>

      {/* Voyages disponibles */}
      <div ref={resultsRef} className="scroll-mt-20">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e88d6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {t("search.available")}
          </h2>

          {/* Bouton voyage le plus proche — visible après recherche avec résultats */}
          {searched && results.length > 0 && (
            <button
              type="button"
              onClick={handleNearest}
              disabled={geoLoading}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-soft active:scale-95 transition disabled:opacity-60 ${
                nearMode
                  ? "bg-white text-brand-700 ring-2 ring-brand-500"
                  : "text-white"
              }`}
              style={
                nearMode
                  ? undefined
                  : { backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" }
              }
            >
              {geoLoading ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7" />
                  <line x1="12" y1="1" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="23" />
                  <line x1="1" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="23" y2="12" />
                  <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
                </svg>
              )}
              {geoLoading
                ? t("search.locating")
                : nearMode
                  ? t("search.nearestActive")
                  : t("search.nearestBtn")}
              {nearMode && !geoLoading && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              )}
            </button>
          )}

          <span className="ml-auto inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-slate-100 text-slate-600 text-sm font-bold shrink-0">
            {results.length}
          </span>
        </div>

        {geoError && (
          <p className="mb-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
            {geoError}
          </p>
        )}

        {nearMode && radiusKm != null && (
          <p className="mb-3 text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-xl inline-flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            {t("search.radiusInfo", { km: radiusKm })}
          </p>
        )}

        {tripsError && (
          <p className="mb-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">
            {tripsError}
          </p>
        )}

        {loading ? (
          <Spinner />
        ) : results.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 space-y-2">
            <p>{t("search.noTrips")}</p>
            <p className="text-sm text-slate-400">{t("search.noTripsHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ tr, dist }) => (
              <Link
                key={tr.id}
                to={`/trips/${tr.id}`}
                className="card p-4 flex items-start gap-3 sm:gap-4 hover:shadow-md transition"
              >
                <div className="text-center shrink-0 w-14 sm:w-16">
                  <div className="text-sm sm:text-base font-extrabold text-brand-600 leading-none">
                    {formatPeriod(tr.depart_at)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
                    {relativeDateLabel(tr.depart_at)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink text-sm sm:text-base leading-snug">
                    {isAr ? tr.from_name_ar : tr.from_name_fr}
                    <span className="text-slate-400 mx-1">→</span>
                    {isAr ? tr.to_name_ar : tr.to_name_fr}
                  </div>
                  <div className="muted flex items-center gap-2 mt-1.5 flex-wrap">
                    {tr.driver_name && (
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <span
                          className="w-5 h-5 rounded-full inline-flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
                        >
                          {tr.driver_name.charAt(0)}
                        </span>
                        <span className="truncate max-w-[100px] sm:max-w-[140px]">
                          {tr.driver_name}
                        </span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      {tr.seats_available}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[72px] sm:min-w-[80px]">
                  <div className="font-extrabold text-brand-600 text-sm sm:text-base leading-tight">
                    {formatPrice(tr.price_per_seat)}
                  </div>
                  {nearMode && dist != null && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 bg-brand-50 rounded-full px-2 py-0.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                      {t("search.departAt", { km: Math.round(dist) })}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* En savoir plus sur Easy Dunya — simple lien */}
      <div className="text-center pb-2">
        <Link
          to="/a-propos"
          className="inline-flex items-center gap-1.5 text-brand-600 font-semibold hover:text-brand-700"
        >
          {t("home.aboutTitle")}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </Link>
      </div>
    </div>
  );
}

function CitySelect({
  value,
  onChange,
  cities,
  cityName,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  cities: CityOption[];
  cityName: (c: CityOption) => string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const selected = cities.find((c) => c.id === value);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-start focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
      >
        <span className={selected ? "text-ink" : "text-slate-400"}>
          {selected ? cityName(selected) : placeholder}
        </span>
        <svg
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-[2000] mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-card">
          <button
            type="button"
            onClick={() => select("")}
            className="block w-full px-4 py-2.5 text-start text-slate-400 hover:bg-slate-50"
          >
            {placeholder}
          </button>
          {cities.map((c) => {
            const active = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-brand-50 ${active ? "bg-brand-50 font-semibold text-brand-700" : "text-ink"}`}
              >
                {cityName(c)}
                {active && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
