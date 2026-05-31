import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MapView from "../components/MapView";
import TripList from "../components/TripList";
import { useCityCounts, useUpcomingTrips } from "../hooks/useTrips";

export default function Home() {
  const { t, i18n } = useTranslation();
  const [cityId, setCityId] = useState<string | null>(null);
  const { cities } = useCityCounts();
  const { trips, loading } = useUpcomingTrips({ cityId });

  const selectedCityName =
    cities.find((c) => c.id === cityId)?.[
      i18n.language === "ar" ? "name_ar" : "name_fr"
    ];

  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        <div className="page py-10 sm:py-14">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tight">
                {t("home.heroTitle")}
              </h1>
              <p className="mt-3 text-brand-50/90 text-base sm:text-lg max-w-prose">
                {t("home.heroSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="#trips" className="btn bg-white text-brand-700 hover:bg-brand-50">
                  {t("home.ctaBook")}
                </a>
                <Link
                  to="/check"
                  className="btn bg-brand-800/40 text-white ring-1 ring-white/40 hover:bg-brand-800/60"
                >
                  {t("home.ctaCheck")}
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-7xl text-center select-none">🚐</div>
              <p className="text-center text-brand-100 mt-2 italic">
                {t("app.tagline")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="page" id="trips">
        <h2 className="h2 mb-3">{t("home.upcomingTrips")}</h2>

        <div className="mb-6">
          <MapView
            cities={cities}
            selectedCityId={cityId}
            onSelectCity={setCityId}
          />
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-sm text-slate-500">{t("home.filterCity")} :</span>
            <button
              onClick={() => setCityId(null)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                !cityId
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {t("home.allCities")}
            </button>
            {cities
              .filter((c) => c.upcoming_trips > 0)
              .map((c) => {
                const name = i18n.language === "ar" ? c.name_ar : c.name_fr;
                const active = cityId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCityId(active ? null : c.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                      active
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {name} ({c.upcoming_trips})
                  </button>
                );
              })}
          </div>
        </div>

        {selectedCityName && (
          <p className="muted mb-3">→ {selectedCityName}</p>
        )}

        <TripList trips={trips} loading={loading} />
      </section>
    </>
  );
}
