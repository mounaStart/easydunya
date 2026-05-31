import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import LangSwitcher from "./LangSwitcher";
import { cn } from "../lib/utils";

export default function Header() {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isDriver, isPassenger, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links: { to: string; label: string }[] = [
    { to: "/", label: t("nav.home") },
    { to: "/check", label: t("nav.checkBooking") },
  ];
  if (isPassenger) links.push({ to: "/me/bookings", label: t("nav.bookings") });
  if (isDriver) {
    links.push(
      { to: "/driver", label: t("nav.dashboard") },
      { to: "/driver/trips/new", label: t("nav.newTrip") },
      { to: "/driver/vehicles", label: t("nav.vehicles") }
    );
  }
  if (isAdmin) links.push({ to: "/admin", label: t("nav.dashboard") });

  async function handleLogout() {
    await signOut();
    setOpen(false);
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span className="text-2xl">🚐</span>
          <span className="text-lg sm:text-xl">Easy Dunya</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangSwitcher />
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-slate-500 max-w-[140px] truncate">
                {profile?.full_name ?? user.email}
              </span>
              <button onClick={handleLogout} className="btn-ghost text-sm">
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm">
                {t("nav.login")}
              </Link>
              <Link
                to="/register"
                className="btn-primary text-sm hidden sm:inline-flex"
              >
                {t("nav.register")}
              </Link>
            </>
          )}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setOpen((o) => !o)}
            aria-label="menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-2 flex flex-col">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-2.5 rounded-lg text-sm font-medium",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-700 hover:bg-slate-50"
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            {!user && (
              <Link
                to="/register"
                onClick={() => setOpen(false)}
                className="btn-primary text-sm mt-2"
              >
                {t("nav.register")}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
