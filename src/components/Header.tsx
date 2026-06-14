import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import LangSwitcher from "./LangSwitcher";
import NotificationBell from "./NotificationBell";
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
  }

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-white ring-1 ring-slate-100 shadow-soft shrink-0 flex items-center justify-center">
            <img
              src="/brand/emblem.png"
              alt="Easy Dunya"
              className="w-full h-full object-contain"
            />
          </span>
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight">
            <span className="text-brand-600">Easy</span>
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
          <NotificationBell />
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
        </div>
      </div>
    </header>
  );
}
