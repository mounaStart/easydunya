import { useTranslation } from "react-i18next";

export default function LangSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("ar") ? "ar" : "fr";

  function set(lang: "fr" | "ar") {
    i18n.changeLanguage(lang);
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
