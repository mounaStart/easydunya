import { useState } from "react";
import { Link } from "react-router-dom";
import LangSwitcher from "./LangSwitcher";
import NotificationBell from "./NotificationBell";
import BrandLogo from "./BrandLogo";
import MobileNavDrawer from "./MobileNavDrawer";

/** En-tête mobile passager — identique à la maquette (menu · logo · cloche · langue). */
export default function PassengerHomeHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-30 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-[379px] mx-auto h-[3.25rem] px-3 grid grid-cols-[2.5rem_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-700 hover:bg-slate-50"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link to="/" className="justify-self-center min-w-0" aria-label="Easy Dunya">
            <BrandLogo showEmblem={false} textClassName="text-[1.125rem]" className="justify-center" />
          </Link>
          <div className="flex items-center gap-0.5 shrink-0">
            <NotificationBell alwaysVisible />
            <LangSwitcher variant="dropdown" />
          </div>
        </div>
      </header>
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
