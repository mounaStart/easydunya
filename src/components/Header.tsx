import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

function UserAvatarMenu({
  name,
  email,
  onLogout,
}: {
  name?: string | null;
  email?: string | null;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && menuPos
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/25 md:hidden"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[70] min-w-[11.5rem] rounded-2xl border border-slate-100 bg-white py-1 shadow-xl"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-3.5 text-start text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                onClick={() => {
                  setOpen(false);
                  navigate("/profile");
                }}
              >
                {t("nav.profile")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-4 py-3.5 text-start text-sm font-semibold text-rose-600 hover:bg-rose-50 active:bg-rose-100"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                {t("nav.logout")}
              </button>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white font-bold text-sm shadow-soft shrink-0"
        style={{ backgroundImage: "linear-gradient(135deg,#1e88d6,#f97316)" }}
        title={name ?? email ?? t("nav.profile")}
        aria-label={t("nav.profile")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials(name, email)}
      </button>
      {menu}
    </>
  );
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
    <header className={cn("app-header sticky top-0 z-30 bg-white border-b border-slate-100 w-full max-w-[100vw] overflow-x-hidden", className)}>
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
            <UserAvatarMenu
              name={profile?.full_name}
              email={user.email}
              onLogout={handleLogout}
            />
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
