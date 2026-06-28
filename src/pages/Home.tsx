import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MapView from "../components/MapView";
import PassengerHero from "../components/PassengerHero";
import Spinner from "../components/Spinner";
import { useCities } from "../hooks/useCities";
import { useCityCounts, useUpcomingTrips } from "../hooks/useTrips";
import type { TripPublic } from "../lib/types";
import { distanceKm, formatPrice, formatPeriod, isoToday, relativeDateLabel } from "../lib/utils";

const NOUAKCHOTT_ID = "11111111-1111-1111-1111-000000000001";
const BOGHE_ID = "11111111-1111-1111-1111-000000000004";

const SEARCH_BLUE = "#1976d2";
const SEARCH_BLUE_INNER = "#1565c0";
const SEARCH_RED = "#e53935";
const SEARCH_BTN_GRADIENT = `linear-gradient(90deg, ${SEARCH_BLUE} 0%, #f97316 100%)`;
const PAGE_SIZE = 10;

function isoTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSearchDate(dateStr: string, locale: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel =
    d.toDateString() === tomorrow.toDateString()
      ? locale.startsWith("ar")
        ? "غداً"
        : "Demain"
      : d.toDateString() === today.toDateString()
        ? locale.startsWith("ar")
          ? "اليوم"
          : "Aujourd'hui"
        : d.toLocaleDateString(locale, { weekday: "long" });
  const full = d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const capitalized = full.charAt(0).toUpperCase() + full.slice(1);
  return dayLabel === capitalized || dayLabel === full
    ? capitalized
    : `${dayLabel}, ${capitalized}`;
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { cities } = useCities();
  const { cities: cityCounts } = useCityCounts();
  const { trips, loading, error: tripsError } = useUpcomingTrips({ days: 30 });

  const [fromId, setFromId] = useState(NOUAKCHOTT_ID);
  const [toId, setToId] = useState(BOGHE_ID);
  const [date, setDate] = useState(isoTomorrow);
  const [passengers, setPassengers] = useState(1);
  const [tab, setTab] = useState<"quick" | "map">("quick");
  const [searched, setSearched] = useState(false);
  const [browsePage, setBrowsePage] = useState(0);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMode, setNearMode] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const fromSelectRef = useRef<HTMLSelectElement>(null);
  const toSelectRef = useRef<HTMLSelectElement>(null);
  const passengersSelectRef = useRef<HTMLSelectElement>(null);

  const cityName = (c: { name_fr: string; name_ar: string }) =>
    isAr ? c.name_ar : c.name_fr;

  const RADIUS_STEPS = [10, 25, 50, 100, 200, 500];

  const { items: filteredResults, radiusKm } = useMemo(() => {
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

    withDist.sort((a, b) => {
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });

    let chosen: number | null = null;
    for (const step of RADIUS_STEPS) {
      if (withDist.some((x) => x.dist != null && x.dist <= step)) {
        chosen = step;
        break;
      }
    }

    if (chosen == null) {
      return { items: withDist, radiusKm: null as number | null };
    }

    const within = withDist.filter((x) => x.dist != null && x.dist <= chosen!);
    return { items: within, radiusKm: chosen };
  }, [trips, fromId, toId, date, nearMode, userPos]);

  const browseAll = useMemo(
    () => trips.map((tr) => ({ tr, dist: null as number | null })),
    [trips]
  );

  const totalBrowsePages = Math.max(1, Math.ceil(browseAll.length / PAGE_SIZE));
  const safeBrowsePage = Math.min(browsePage, totalBrowsePages - 1);

  const displayedResults = searched
    ? filteredResults
    : browseAll.slice(safeBrowsePage * PAGE_SIZE, (safeBrowsePage + 1) * PAGE_SIZE);

  const resultCount = searched ? filteredResults.length : browseAll.length;

  const fromCity = cities.find((c) => c.id === fromId);
  const toCity = cities.find((c) => c.id === toId);

  const defaultCityLabel = (id: string, fallback: string) => {
    const c = cities.find((x) => x.id === id);
    return c ? cityName(c) : fallback;
  };

  const handleSearch = () => {
    setSearched(true);
    setNearMode(false);
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
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120_000 }
    );
  };

  return (
    <div className="w-full max-w-[379px] mx-auto bg-[#eef5fc] min-h-full pb-6">
      {/* Hero pleine largeur + carte recherche inset à l'intérieur (maquette) */}
      <div className="px-3 pt-4">
        <div className="relative w-full">
          <PassengerHero />

          {/* Carte plus étroite, centrée dans le hero — route visible sur les côtés */}
          <div className="relative z-10 -mt-[1.625rem] mx-4">
            <div className="w-full rounded-[20px] overflow-hidden shadow-[0_10px_36px_rgba(30,136,214,0.16)] bg-white">
              <div className="p-2.5 pb-0">
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#eceff3] rounded-[14px]">
                  <button
                    type="button"
                    onClick={() => setTab("quick")}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 px-2 text-[11px] font-semibold transition ${
                      tab === "quick"
                        ? "text-white bg-[#1976d2]"
                        : "text-[#9aa3ab] bg-transparent"
                    }`}
                  >
                    <QuickSearchTabIcon />
                    {t("search.tabQuick")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("map")}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 px-2 text-[11px] font-semibold transition ${
                      tab === "map"
                        ? "text-white bg-[#1976d2]"
                        : "text-[#9aa3ab] bg-transparent"
                    }`}
                  >
                    <MapTabIcon />
                    {t("search.tabMap")}
                  </button>
                </div>
              </div>

          {tab === "quick" ? (
            <div className="p-3 pt-2 pb-3">
              <div className="rounded-[14px] border border-[#e8ecf0] overflow-hidden divide-y divide-[#e8ecf0]">
              <SearchField
                label={t("search.fieldDeparture")}
                icon={<PinIcon variant="blue" />}
                value={fromCity ? cityName(fromCity) : defaultCityLabel(NOUAKCHOTT_ID, "Nouakchott")}
                onClick={() => fromSelectRef.current?.showPicker?.() ?? fromSelectRef.current?.click()}
              >
                <select
                  ref={fromSelectRef}
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  aria-label={t("search.fieldDeparture")}
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{cityName(c)}</option>
                  ))}
                </select>
              </SearchField>

              <SearchField
                label={t("search.fieldArrival")}
                icon={<PinIcon variant="red" />}
                value={toCity ? cityName(toCity) : defaultCityLabel(BOGHE_ID, "Boghé")}
                onClick={() => toSelectRef.current?.showPicker?.() ?? toSelectRef.current?.click()}
              >
                <select
                  ref={toSelectRef}
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  aria-label={t("search.fieldArrival")}
                >
                  <option value="">{t("search.selectCity")}</option>
                  {cities.filter((c) => c.id !== fromId).map((c) => (
                    <option key={c.id} value={c.id}>{cityName(c)}</option>
                  ))}
                </select>
              </SearchField>

              <SearchField
                label={t("search.tripDate")}
                icon={<CalendarFieldIcon />}
                value={date ? formatSearchDate(date, i18n.language) : t("search.selectDate")}
                onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
              >
                <input
                  ref={dateInputRef}
                  type="date"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  value={date}
                  min={isoToday()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && v < isoToday()) return;
                    setDate(v);
                  }}
                />
              </SearchField>

              <SearchField
                label={t("search.passengersLabel")}
                icon={<PassengersFieldIcon />}
                value={t("search.passengerCount", { count: passengers })}
                trailing={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/></svg>
                }
                onClick={() => passengersSelectRef.current?.showPicker?.() ?? passengersSelectRef.current?.click()}
              >
                <select
                  ref={passengersSelectRef}
                  value={passengers}
                  onChange={(e) => setPassengers(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  aria-label={t("search.passengersLabel")}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </SearchField>
              </div>

              <SearchTripsButton
                onClick={handleSearch}
                label={t("search.searchTripsBtn")}
                className="mt-3"
              />
            </div>
          ) : (
            <div className="p-3 pt-2 pb-3 space-y-3">
              <MapView
                cities={cityCounts}
                selectedCityId={fromId || null}
                onSelectCity={(id) => setFromId(id ?? "")}
                height={220}
              />
              <SearchTripsButton onClick={handleSearch} label={t("search.searchTripsBtn")} />
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div ref={resultsRef} className="px-4 mt-5 scroll-mt-24">
        <SearchResults
          loading={loading}
          tripsError={tripsError}
          geoError={geoError}
          results={displayedResults}
          resultCount={resultCount}
          searched={searched}
          radiusKm={radiusKm}
          nearMode={nearMode}
          geoLoading={geoLoading}
          onNearest={handleNearest}
          browsePage={safeBrowsePage}
          totalBrowsePages={totalBrowsePages}
          onBrowsePage={setBrowsePage}
          isAr={isAr}
          t={t}
        />
      </div>
    </div>
  );
}

function SearchTripsButton({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full py-3.5 rounded-full text-white font-bold text-[14px] active:scale-[0.99] transition ${className}`}
      style={{ background: SEARCH_BTN_GRADIENT }}
    >
      <span className="block text-center px-10">{label}</span>
      <svg
        className="absolute right-4 top-1/2 -translate-y-1/2 shrink-0"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

function QuickSearchTabIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </svg>
  );
}

function MapTabIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function PinIcon({ variant }: { variant: "blue" | "red" }) {
  const fill = variant === "blue" ? SEARCH_BLUE : SEARCH_RED;
  const dot = variant === "blue" ? SEARCH_BLUE_INNER : "#c62828";
  const headCx = 12;
  const headCy = 10.5;
  const headR = 5.5;
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d={`M${headCx} 21.5 C${headCx - 2} 17 ${headCx - headR} 13.5 ${headCx - headR} ${headCy} A${headR} ${headR} 0 1 1 ${headCx + headR} ${headCy} C${headCx + headR} 13.5 ${headCx + 2} 17 ${headCx} 21.5 Z`}
        fill={fill}
      />
      <circle cx={headCx} cy={headCy} r="2.45" fill="none" stroke="white" strokeWidth="2" />
      <circle cx={headCx} cy={headCy} r="0.78" fill={dot} />
    </svg>
  );
}

function CalendarFieldIcon() {
  const c = SEARCH_BLUE;
  const sw = 1.85;
  const dots = [
    [8, 14.2],
    [12, 14.2],
    [16, 14.2],
    [8, 17.8],
    [12, 17.8],
    [16, 17.8],
  ] as const;
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <rect x="4" y="6" width="16" height="15" rx="2.8" stroke={c} strokeWidth={sw} />
      <path d="M8 6V3.6M16 6V3.6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <path d="M4 10.5h16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      {dots.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={c} />
      ))}
    </svg>
  );
}

function PassengersFieldIcon() {
  const c = SEARCH_BLUE;
  const sw = 1.85;
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle cx="16.2" cy="8" r="2.6" stroke={c} strokeWidth={sw} />
      <path d="M12.8 17.8c0-2.8 1.6-4.7 3.4-4.7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <circle cx="9.2" cy="9" r="3" stroke={c} strokeWidth={sw} />
      <path d="M4.8 18.2c0-3.5 2.2-5.7 4.4-5.7s4.4 2.2 4.4 5.7" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg className="shrink-0 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchField({
  label,
  icon,
  value,
  onClick,
  trailing,
  children,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onClick?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative cursor-pointer" onClick={onClick}>
      <div className="flex items-center gap-3 bg-white px-3 py-2.5 min-h-[60px]">
        <span className="shrink-0 w-11 h-11 inline-flex items-center justify-center" aria-hidden>
          {icon}
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[11px] font-normal text-[#94a3b8] leading-none mb-1">{label}</span>
          <span className="block text-[15px] font-bold text-[#1e293b] truncate leading-tight">{value}</span>
        </span>
        {trailing ?? <ChevronDown />}
      </div>
      {children}
    </div>
  );
}

function SearchResults({
  loading,
  tripsError,
  geoError,
  results,
  resultCount,
  searched,
  radiusKm,
  nearMode,
  geoLoading,
  onNearest,
  browsePage,
  totalBrowsePages,
  onBrowsePage,
  isAr,
  t,
}: {
  loading: boolean;
  tripsError: string | null;
  geoError: string | null;
  results: { tr: TripPublic; dist: number | null }[];
  resultCount: number;
  searched: boolean;
  radiusKm: number | null;
  nearMode: boolean;
  geoLoading: boolean;
  onNearest: () => void;
  browsePage: number;
  totalBrowsePages: number;
  onBrowsePage: (page: number) => void;
  isAr: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isEmpty = !loading && resultCount === 0;

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h2 className="text-base font-bold text-ink">{t("search.available")}</h2>
        {searched && resultCount > 0 && (
          <button
            type="button"
            onClick={onNearest}
            disabled={geoLoading}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
              nearMode ? "bg-white text-brand-700 ring-2 ring-brand-500" : "text-white"
            }`}
            style={nearMode ? undefined : { backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" }}
          >
            {geoLoading ? t("search.locating") : nearMode ? t("search.nearestActive") : t("search.nearestBtn")}
          </button>
        )}
        <span className="ml-auto text-sm font-bold text-slate-500">{resultCount}</span>
      </div>

      {geoError && <p className="mb-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{geoError}</p>}
      {tripsError && <p className="mb-3 text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{tripsError}</p>}
      {searched && nearMode && radiusKm != null && (
        <p className="mb-3 text-sm text-brand-700 bg-brand-50 px-3 py-2 rounded-xl">
          {t("search.radiusInfo", { km: radiusKm })}
        </p>
      )}

      {loading ? (
        <Spinner />
      ) : isEmpty ? (
        <>
          <div className="card p-6 text-center text-slate-500 text-sm space-y-1">
            {searched ? (
              <>
                <p>{t("search.noTrips")}</p>
                <p className="text-slate-400">{t("search.noTripsHint")}</p>
              </>
            ) : (
              <>
                <p>{t("search.noTripsAvailable")}</p>
                <p className="text-slate-400">{t("search.noTripsAvailableHint")}</p>
              </>
            )}
          </div>
          <div className="mt-4 text-center">
            <Link
              to="/a-propos"
              className="inline-flex items-center gap-1.5 text-[#1976d2] font-bold text-[14px] hover:opacity-80 transition"
            >
              {t("home.aboutTitle")}
              <span aria-hidden>→</span>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {results.map(({ tr, dist }) => (
              <Link
                key={tr.id}
                to={`/trips/${tr.id}`}
                className="card p-4 flex items-start gap-3 hover:shadow-md transition"
              >
                <div className="text-center shrink-0 w-14">
                  <div className="text-base font-extrabold text-brand-600">{formatPeriod(tr.depart_at)}</div>
                  <div className="text-[10px] uppercase text-slate-400 mt-1">{relativeDateLabel(tr.depart_at)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink text-sm leading-snug">
                    {isAr ? tr.from_name_ar : tr.from_name_fr}
                    <span className="text-slate-400 mx-1">→</span>
                    {isAr ? tr.to_name_ar : tr.to_name_fr}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {tr.seats_available} {t("common.seats").toLowerCase()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-extrabold text-brand-600">{formatPrice(tr.price_per_seat)}</div>
                  {searched && nearMode && dist != null && (
                    <div className="text-xs text-brand-600 mt-1">{t("search.departAt", { km: Math.round(dist) })}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {!searched && totalBrowsePages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                type="button"
                disabled={browsePage <= 0}
                onClick={() => onBrowsePage(browsePage - 1)}
                className="rounded-full px-4 py-2 text-xs font-bold text-brand-700 bg-white border border-slate-200 disabled:opacity-40"
              >
                {t("search.pagePrev")}
              </button>
              <span className="text-xs font-semibold text-slate-500">
                {t("search.pageOf", { page: browsePage + 1, total: totalBrowsePages })}
              </span>
              <button
                type="button"
                disabled={browsePage >= totalBrowsePages - 1}
                onClick={() => onBrowsePage(browsePage + 1)}
                className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#0f6fb8)" }}
              >
                {t("search.pageNext")}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
