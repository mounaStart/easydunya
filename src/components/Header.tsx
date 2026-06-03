import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import LangSwitcher from "./LangSwitcher";
import { cn } from "../lib/utils";

interface NavLinkItem {
  to: string;
  label: string;
  badge?: number;
}

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "?").trim();
  return base.charAt(0).toUpperCase();
}

export default function Header() {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isDriver, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingDriversCount, setPendingDriversCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    async function load() {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "driver")
        .eq("driver_status", "pending");
      if (!cancelled) setPendingDriversCount(count ?? 0);
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  const driverApproved = profile?.driver_status === "approved";

  const links: NavLinkItem[] = [{ to: "/", label: t("nav.home") }];
  if (isDriver) {
    links.push({ to: "/driver", label: t("nav.dashboard") });
    if (driverApproved) {
      links.push(
        { to: "/driver/trips/new", label: t("nav.newTrip") },
        { to: "/driver/vehicles", label: t("nav.vehicles") }
      );
    }
  } else if (isAdmin) {
    links.push({
      to: "/admin",
      label: t("nav.dashboard"),
      badge: pendingDriversCount > 0 ? pendingDriversCount : undefined,
    });
  } else {
    links.push(
      { to: "/reservation", label: t("nav.reservation") },
      { to: "/historique", label: t("nav.historique") }
    );
  }

  async function handleLogout() {
    await signOut();
    setOpen(false);
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="icon-tile w-9 h-9 shadow-soft overflow-hidden">
            <img
              src="/brand/logo.png"
              alt=""
              className="w-full h-full object-cover"
            />
          </span>
          <span className="text-lg sm:text-xl font-extrabold tracking-tight">
            <span className="text-ink">Easy</span>
            <span className="text-accent-500">Dunya</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative px-3 py-2 rounded-xl text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50"
                )
              }
            >
              {l.label}
              {l.badge !== undefined && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {l.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            className="hidden sm:inline-flex p-2 rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="notifications"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.7 21a2 2 0 0 1-3.4 0" />
            </svg>
          </button>
          <LangSwitcher />
          {user ? (
            <>
              <Link
                to="/profile"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white font-bold text-sm shadow-soft"
                style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
                title={profile?.full_name ?? user.email ?? ""}
              >
                {initials(profile?.full_name, user.email)}
              </Link>
              <button
                onClick={handleLogout}
                className="hidden md:inline-flex btn-ghost text-sm"
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm hidden sm:inline-flex">
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
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-700 hover:bg-slate-50"
                  )
                }
              >
                <span>{l.label}</span>
                {l.badge !== undefined && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {l.badge}
                  </span>
                )}
              </NavLink>
            ))}
            {user ? (
              <button onClick={handleLogout} className="btn-secondary text-sm mt-2">
                {t("nav.logout")}
              </button>
            ) : (
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
