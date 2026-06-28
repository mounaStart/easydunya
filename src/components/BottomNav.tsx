import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../lib/utils";

function IconHome(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function IconBriefcase(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}
function IconHistory(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" />
    </svg>
  );
}
function IconUser(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a7 7 0 0 1 14 0v1" />
    </svg>
  );
}
function IconDashboard(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function IconShield(props: { className?: string }) {
  return (
    <svg className={props.className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6z" />
    </svg>
  );
}

export default function BottomNav() {
  const { t } = useTranslation();
  const { user, isDriver, isAdmin } = useAuth();

  const home = { to: "/", label: t("nav.home"), Icon: IconHome, end: true };
  const profile = {
    to: user ? "/profile" : "/login",
    label: t("nav.profile"),
    Icon: IconUser,
    end: false,
  };

  let items;
  if (isDriver) {
    items = [
      home,
      { to: "/driver", label: t("nav.dashboardShort"), Icon: IconDashboard, end: true },
      { to: "/driver/historique", label: t("nav.historique"), Icon: IconHistory, end: false },
      profile,
    ];
  } else if (isAdmin) {
    items = [
      home,
      { to: "/admin", label: t("nav.adminShort"), Icon: IconShield, end: true },
      profile,
    ];
  } else {
    items = [
      home,
      { to: "/reservation", label: t("nav.reservation"), Icon: IconBriefcase, end: false },
      { to: "/historique", label: t("nav.historique"), Icon: IconHistory, end: false },
      profile,
    ];
  }

  const isPassengerNav = !isDriver && !isAdmin;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
      <div className="max-w-[379px] mx-auto grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition",
                isActive ? "text-[#2196f3]" : "text-slate-400"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isPassengerNav && isActive ? (
                  <span className="w-9 h-9 rounded-2xl bg-[#e3f2fd] inline-flex items-center justify-center">
                    <Icon className="text-[#2196f3]" />
                  </span>
                ) : (
                  <Icon className={cn("w-6 h-6", isActive && !isPassengerNav && "text-brand-600")} />
                )}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
