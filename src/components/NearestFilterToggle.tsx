import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

type Props = {
  enabled: boolean;
  busy?: boolean;
  error?: string | null;
  onToggle: () => void;
};

/** Option facultative : le chauffeur clique seulement s’il veut filtrer. */
export default function NearestFilterToggle({ enabled, busy, error, onToggle }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition disabled:opacity-50",
          enabled
            ? "bg-brand-600 text-white border-brand-600"
            : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
        )}
      >
        <span aria-hidden>📍</span>
        {busy
          ? t("driver.nearestFilterBusy")
          : enabled
            ? t("driver.nearestFilterOn")
            : t("driver.nearestFilter")}
      </button>
      <p className="text-[11px] text-slate-500">{t("driver.nearestFilterHint")}</p>
      {error && <p className="text-[11px] text-rose-700">{error}</p>}
    </div>
  );
}
