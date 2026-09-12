import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Header from "./Header";
import BottomNav from "./BottomNav";
import ScrollToTop from "./ScrollToTop";
import NotificationPrompt from "./NotificationPrompt";
import LocationPrompt from "./LocationPrompt";
import PassengerLocationSync from "./PassengerLocationSync";
import DriverLocationGate from "./DriverLocationGate";
import DriverGpsSync from "./DriverGpsSync";
import PullToRefresh from "./PullToRefresh";
import TermsGate from "./TermsGate";
import { dispatchAppRefresh } from "../lib/appRefresh";
import { hasAcceptedTerms } from "../lib/termsAcceptance";
import { useAuth } from "../hooks/useAuth";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { cn } from "../lib/utils";

/** Force le changement de mot de passe (1ère connexion chauffeur). */
function PasswordChangeGate() {
  const { mustChangePassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (user && mustChangePassword && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user, mustChangePassword, location.pathname, navigate]);
  return null;
}

export default function Layout() {
  const location = useLocation();
  const { isDriver, isAdmin, refreshProfile } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(hasAcceptedTerms);
  useAndroidBackButton();

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (!hasAcceptedTerms()) setTermsAccepted(false);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const isPassengerHome = location.pathname === "/" && !isDriver && !isAdmin;

  const handlePullRefresh = useCallback(async () => {
    dispatchAppRefresh({ resetHome: isPassengerHome });
    await refreshProfile();
  }, [isPassengerHome, refreshProfile]);

  useEffect(() => {
    let lastRefresh = 0;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < 5000) return;
      lastRefresh = now;
      dispatchAppRefresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!termsAccepted) {
    return <TermsGate onAccepted={() => setTermsAccepted(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden max-w-[100vw]">
      <ScrollToTop />
      <PasswordChangeGate />
      <DriverLocationGate />
      <PassengerLocationSync />
      <DriverGpsSync />
      <Header />
      <main className={cn("flex-1 has-bottom-nav", isPassengerHome && "bg-[#eef5fc]")}>
        <LocationPrompt />
        <PullToRefresh onRefresh={handlePullRefresh} enabled={!isDriver && !isAdmin}>
          <Outlet />
        </PullToRefresh>
      </main>
      <footer className="hidden md:block bg-white border-t border-slate-100 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Easy Dunya — Adam Ba &amp; Maimouna Dia
      </footer>
      <NotificationPrompt />
      <BottomNav />
    </div>
  );
}
