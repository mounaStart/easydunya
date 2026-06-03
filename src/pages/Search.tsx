import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MapView from "../components/MapView";
import Spinner from "../components/Spinner";
import { useCities } from "../hooks/useCities";
import { useCityCounts, useUpcomingTrips } from "../hooks/useTrips";
import {
  formatPrice,
  formatTime,
  relativeDateLabel,
} from "../lib/utils";

export default function Search() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { cities } = useCities();
  const { cities: cityCounts } = useCityCounts();
  const { trips, loading } = useUpcomingTrips({ days: 30 });

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [date, setDate] = useState("");

  const results = useMemo(() => {
    return trips.filter((tr) => {
      if (fromId && tr.from_city_id !== fromId) return false;
      if (toId && tr.to_city_id !== toId) return false;
      if (date) {
        const d = new Date(tr.depart_at);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (localDate !== date) return false;
      }
      return true;
    });
  }, [trips, fromId, toId, date]);

  const cityName = (c: { name_fr: string; name_ar: string }) =>
    isAr ? c.name_ar : c.name_fr;

  return (
    <div className="page space-y-6">
      {/* Formulaire de recherche */}
      <div className="card p-5 sm:p-6">
        <h1 className="text-2xl font-extrabold text-ink text-center">
          {t("search.title")}
        </h1>
        <p className="muted text-center mt-1.5 mb-5">{t("search.subtitle")}</p>

        <div className="space-y-4">
          <div>
            <label className="label">{t("search.fromCity")}</label>
            <select
              className="input"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              <option value="">{t("search.selectCity")}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {cityName(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("search.toCity")}</label>
            <select
              className="input"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">{t("search.selectCity")}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {cityName(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("search.tripDate")}</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full py-4" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            {t("search.searchBtn")}
          </button>
        </div>
      </div>

      {/* Carte */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e88d6" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
          {t("search.mapTitle")}
        </h2>
        <MapView
          cities={cityCounts}
          selectedCityId={fromId || null}
          onSelectCity={(id) => setFromId(id ?? "")}
          legend
          height={300}
        />
        <p className="muted mt-3 flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          {t("search.mapHint")}
        </p>
      </div>

      {/* Résultats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e88d6" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {t("search.available")}
          </h2>
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full bg-slate-100 text-slate-600 text-sm font-bold">
            {results.length}
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : results.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            {t("search.noTrips")}
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((tr) => (
              <Link
                key={tr.id}
                to={`/trips/${tr.id}`}
                className="card p-4 flex items-center gap-4 hover:shadow-md transition"
              >
                <div className="text-center shrink-0 w-16">
                  <div className="text-xl font-extrabold text-brand-600 leading-none">
                    {formatTime(tr.depart_at)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
                    {relativeDateLabel(tr.depart_at)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <span className="truncate">
                      {isAr ? tr.from_name_ar : tr.from_name_fr}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 shrink-0"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    <span className="truncate">
                      {isAr ? tr.to_name_ar : tr.to_name_fr}
                    </span>
                  </div>
                  <div className="muted flex items-center gap-2 mt-0.5">
                    {tr.driver_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full inline-flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
                        >
                          {tr.driver_name.charAt(0)}
                        </span>
                        <span className="truncate max-w-[120px]">{tr.driver_name}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                      {tr.seats_available}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 font-extrabold text-brand-600">
                  {formatPrice(tr.price_per_seat)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
