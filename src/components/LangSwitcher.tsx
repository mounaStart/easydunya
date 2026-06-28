import { useTranslation } from "react-i18next";

type LangSwitcherProps = {
  variant?: "toggle" | "dropdown";
};

export default function LangSwitcher({ variant = "toggle" }: LangSwitcherProps) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("ar") ? "ar" : "fr";

  function set(lang: "fr" | "ar") {
    i18n.changeLanguage(lang);
  }

  if (variant === "dropdown") {
    return (
      <div className="relative inline-flex shrink-0">
        <select
          value={current}
          onChange={(e) => set(e.target.value as "fr" | "ar")}
          className="appearance-none rounded-full border border-slate-200 bg-white pl-2.5 pr-7 py-1.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 min-w-[3rem]"
          aria-label="Langue"
        >
          <option value="fr">FR</option>
          <option value="ar">ع</option>
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="inline-flex bg-slate-100 rounded-full p-0.5 sm:p-1 text-[10px] sm:text-xs font-semibold shrink-0">
      <button
        onClick={() => set("fr")}
        className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition ${
          current === "fr" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
        }`}
      >
        FR
      </button>
      <button
        onClick={() => set("ar")}
        className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition ${
          current === "ar" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
        }`}
      >
        ع
      </button>
    </div>
  );
}
