import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ManageBookingsIcon from "./ManageBookingsIcon";

interface Props {
  to?: string;
  /** Badge si demandes en attente. */
  pending?: number;
  /** Version compacte (icône + texte court). */
  size?: "md" | "sm";
  className?: string;
  /** Décoratif à l'intérieur d'une carte déjà cliquable. */
  visual?: boolean;
}

/** Bouton visible « Gérer les réservations » (dégradé Easy Dunya). */
export default function ManageBookingsButton({
  to,
  pending = 0,
  size = "md",
  className = "",
  visual = false,
}: Props) {
  const { t } = useTranslation();
  const iconBox = size === "md" ? "w-9 h-9" : "w-8 h-8";
  const iconSize = size === "md" ? 20 : 17;
  const pad = size === "md" ? "px-3.5 py-2.5" : "px-3 py-2";
  const text = size === "md" ? "text-sm" : "text-xs";
  const classes = `inline-flex items-center gap-2 rounded-2xl font-semibold text-white shadow-md transition shrink-0 ${pad} ${text} ${className}`;

  const content = (
    <>
      <span
        className={`${iconBox} rounded-xl bg-white/20 flex items-center justify-center shrink-0`}
      >
        <ManageBookingsIcon size={iconSize} />
      </span>
      <span className="leading-tight">{t("driver.manageBookings")}</span>
      {pending > 0 && (
        <span className="min-w-[1.35rem] h-5 px-1.5 rounded-full bg-white text-brand-700 text-xs font-bold flex items-center justify-center">
          {pending}
        </span>
      )}
    </>
  );

  if (visual || !to) {
    return (
      <span className={classes} style={{ backgroundImage: "var(--brand-gradient)" }}>
        {content}
      </span>
    );
  }

  return (
    <Link
      to={to}
      className={`${classes} hover:brightness-105 active:scale-[0.98]`}
      style={{ backgroundImage: "var(--brand-gradient)" }}
    >
      {content}
    </Link>
  );
}
