import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import LangSwitcher from "./LangSwitcher";
import NotificationBell from "./NotificationBell";
import BrandLogo from "./BrandLogo";
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

export default function Header({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    links.push(
      { to: "/driver", label: t("nav.dashboard") },
      { to: "/driver/historique", label: t("nav.historique") }
    );
    if (driverApproved) {
      links.push({ to: "/driver/vehicles", label: t("nav.vehicles") });
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
    navigate("/login", { replace: true });
  }

  return (
    <header className={cn("app-header sticky top-0 z-30 bg-white border-b border-slate-100 w-full max-w-[100vw] overflow-hidden", className)}>
      <div className="max-w-6xl mx-auto w-full min-w-0 px-3 sm:px-6 h-14 sm:h-16 flex items-center gap-2 sm:gap-3">
        <Link to="/" className="min-w-0 flex-1 overflow-hidden" aria-label="Easy Dunya">
          <BrandLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-1 shrink-0">
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

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <NotificationBell />
          <LangSwitcher />
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full text-white font-bold text-sm shadow-soft"
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
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-soft bg-brand-gradient transition active:scale-[0.98] sm:btn-primary whitespace-nowrap"
              >
                {t("nav.login")}
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-flex btn-primary text-sm"
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
