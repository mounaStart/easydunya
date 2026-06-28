import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const { t } = useTranslation();
  const { user, isDriver, isAdmin, signOut } = useAuth();

  if (!open) return null;

  const passengerLinks = [
    { to: "/", label: t("nav.home"), end: true },
    { to: "/reservation", label: t("nav.reservation") },
    { to: "/historique", label: t("nav.historique") },
    { to: user ? "/profile" : "/login", label: t("nav.profile") },
  ];

  const links = isDriver
    ? [
        { to: "/driver", label: t("nav.dashboard") },
        { to: "/driver/historique", label: t("nav.historique") },
        { to: "/profile", label: t("nav.profile") },
      ]
    : isAdmin
      ? [
          { to: "/admin", label: t("nav.dashboard") },
          { to: "/profile", label: t("nav.profile") },
        ]
      : passengerLinks;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("common.back")}
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-white shadow-xl p-5 flex flex-col gap-1">
        <div className="font-extrabold text-lg mb-4">
          <span className="text-brand-600">Easy</span>
          <span className="text-accent-500">Dunya</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "rounded-xl px-4 py-3 text-sm font-semibold transition",
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
        {user && (
          <button
            type="button"
            onClick={() => {
              onClose();
              void signOut();
            }}
            className="mt-auto rounded-xl px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left"
          >
            {t("nav.logout")}
          </button>
        )}
      </aside>
    </div>
  );
}
