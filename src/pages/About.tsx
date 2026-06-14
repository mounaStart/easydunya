import { useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCities } from "../hooks/useCities";
import { useUpcomingTrips } from "../hooks/useTrips";
import { formatPrice } from "../lib/utils";

export default function About() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const navigate = useNavigate();
  const { cities } = useCities();
  const { trips } = useUpcomingTrips({ days: 30 });

  // Lignes disponibles : regroupées par trajet, prix minimum
  const lines = useMemo(() => {
    const map = new Map<
      string,
      { from: string; to: string; price: number }
    >();
    for (const tr of trips) {
      const key = `${tr.from_city_id}-${tr.to_city_id}`;
      const from = isAr ? tr.from_name_ar : tr.from_name_fr;
      const to = isAr ? tr.to_name_ar : tr.to_name_fr;
      const existing = map.get(key);
      if (!existing || tr.price_per_seat < existing.price) {
        map.set(key, { from, to, price: tr.price_per_seat });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.price - b.price);
  }, [trips, isAr]);

  return (
    <div className="page max-w-xl space-y-8">
      {/* Hero (le fond dégradé démarre tout en haut) */}
      <section
        className="relative -mx-4 sm:-mx-6 -mt-6 px-4 sm:px-6 pt-5 pb-7"
        style={{
          backgroundImage:
            "linear-gradient(160deg, #d3e6f6 0%, #e6f0fa 38%, #f6ede6 70%, #fbe5d6 100%)",
        }}
      >
        {/* Barre retour */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-brand-700 font-semibold mb-4"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>
          {t("common.back")}
        </button>

        <span className="pill-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 2 2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z"/></svg>
          {t("home.badge")}
        </span>
        <h1 className="mt-4 text-4xl font-extrabold text-ink leading-[1.1] text-start">
          {t("home.heroTitle1")}
          <br />
          {t("home.heroTitle2")}
          <br />
          <span className="gradient-text">{t("home.heroBrand")}</span>
        </h1>
        <p className="muted mt-4 leading-relaxed text-start">{t("home.heroLead")}</p>

        <div className="mt-6 space-y-3">
          <Link to="/" className="btn-primary w-full py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            {t("home.ctaSearch")}
          </Link>
          <Link to="/register" className="btn-secondary w-full py-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 16H9m10 0h1a2 2 0 0 0 2-2v-3l-2-5H5L3 11v3a2 2 0 0 0 2 2h1"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></svg>
            {t("home.ctaBecomeDriver")}
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["A", "B", "C", "D"].map((c, i) => (
              <span
                key={c}
                className="w-8 h-8 rounded-full border-2 border-white inline-flex items-center justify-center text-white text-xs font-bold"
                style={{
                  backgroundImage:
                    i % 2 === 0
                      ? "linear-gradient(135deg,#1e88d6,#3b9fe0)"
                      : "linear-gradient(135deg,#f97316,#ea6c0a)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="text-start">
            <div className="flex text-accent-500">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.3 5.8 20.6l1.6-6.7L2.2 8.9l6.9-.6z"/></svg>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{t("home.satisfied")}</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4">
        <StatCard
          icon={<path d="M14 16H9m10 0h1a2 2 0 0 0 2-2v-3l-2-5H5L3 11v3a2 2 0 0 0 2 2h1"/>}
          extra={<><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></>}
          value="3"
          label={t("home.statDrivers")}
        />
        <StatCard
          icon={<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/>}
          extra={<circle cx="12" cy="10" r="2.5"/>}
          value="500+"
          label={t("home.statTrips")}
        />
        <StatCard
          icon={<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/>}
          extra={<circle cx="12" cy="10" r="2.5"/>}
          value={String(cities.length || 14)}
          label={t("home.statCities")}
        />
        <StatCard
          icon={<path d="M16 21v-2a4 4 0 0 0-3-3.87M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>}
          extra={<circle cx="9" cy="7" r="4"/>}
          value="1000+"
          label={t("home.statPassengers")}
        />
      </section>

      {/* Pourquoi Easy Dunya ? */}
      <section>
        <h2 className="text-2xl font-extrabold text-ink text-center mb-5">
          {t("home.whyTitle")}
        </h2>
        <div className="space-y-3">
          <WhyCard
            icon={<path d="M12 6v6l4 2"/>}
            extra={<circle cx="12" cy="12" r="9"/>}
            title={t("home.why1Title")}
            desc={t("home.why1Desc")}
          />
          <WhyCard
            icon={<path d="M9 12l2 2 4-4"/>}
            extra={<path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z"/>}
            title={t("home.why2Title")}
            desc={t("home.why2Desc")}
          />
          <WhyCard
            icon={<rect x="7" y="2" width="10" height="20" rx="2"/>}
            extra={<path d="M11 18h2"/>}
            title={t("home.why3Title")}
            desc={t("home.why3Desc")}
          />
          <WhyCard
            icon={<path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/>}
            extra={<circle cx="12" cy="10" r="2.5"/>}
            title={t("home.why4Title")}
            desc={t("home.why4Desc")}
          />
        </div>
      </section>

      {/* Lignes disponibles */}
      {lines.length > 0 && (
        <section>
          <h2 className="text-2xl font-extrabold text-ink text-center">
            {t("home.linesTitle")}
          </h2>
          <p className="muted text-center mt-1 mb-5">{t("home.linesSubtitle")}</p>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <Link
                key={i}
                to="/"
                className="card p-4 flex items-center gap-3 hover:shadow-md transition"
              >
                <span className="icon-tile-soft shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <span className="truncate">{l.from}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-400 shrink-0 rtl:rotate-180"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    <span className="truncate">{l.to}</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {t("home.fromPrice")} {formatPrice(l.price)}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 shrink-0 rtl:rotate-180"><path d="M9 6l6 6-6 6"/></svg>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-3xl p-7 text-center text-white bg-brand-gradient-br">
        <h2 className="text-2xl font-extrabold">{t("home.ctaTitle")}</h2>
        <p className="mt-2 text-white/90">{t("home.ctaSubtitle")}</p>
        <Link
          to="/register"
          className="mt-5 inline-flex items-center justify-center gap-2 bg-white text-brand-700 font-bold rounded-2xl px-6 py-3.5 w-full"
        >
          {t("home.ctaButton")}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:rotate-180"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </Link>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  extra,
  value,
  label,
}: {
  icon: ReactNode;
  extra?: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="card p-5 text-center">
      <span className="icon-tile mx-auto">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {extra}
          {icon}
        </svg>
      </span>
      <div className="text-2xl font-extrabold text-ink mt-3">{value}</div>
      <div className="text-sm text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function WhyCard({
  icon,
  extra,
  title,
  desc,
}: {
  icon: ReactNode;
  extra?: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card p-5">
      <span className="icon-tile-soft">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {extra}
          {icon}
        </svg>
      </span>
      <h3 className="font-bold text-ink mt-3">{title}</h3>
      <p className="text-sm text-slate-500 mt-1 leading-snug">{desc}</p>
    </div>
  );
}
