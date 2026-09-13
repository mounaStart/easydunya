import { useCallback, useEffect, useMemo, useState } from "react";
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
import Spinner from "./Spinner";
import { dispatchAppRefresh } from "../lib/appRefresh";
import { resolveTermsAccepted } from "../lib/termsAcceptance";
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
  const {
    isDriver,
    isAdmin,
    refreshProfile,
    signOut,
    user,
    profile,
    loading,
    profileLoading,
  } = useAuth();
  useAndroidBackButton();

  // Ne pas bloquer sur !authReady si le profil a échoué (sinon spinner infini).
  const authPending = loading || profileLoading;

  const termsResolved = useMemo(
    () =>
      resolveTermsAccepted({
        userId: user?.id,
        profile,
        authPending,
      }),
    [user?.id, profile, authPending]
  );

  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(termsResolved);
  const [pendingTooLong, setPendingTooLong] = useState(false);

  useEffect(() => {
    setTermsAccepted(termsResolved);
  }, [termsResolved]);

  useEffect(() => {
    if (termsResolved !== null) {
      setPendingTooLong(false);
      return;
    }
    const id = window.setTimeout(() => setPendingTooLong(true), 2500);
    return () => window.clearTimeout(id);
  }, [termsResolved]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      setTermsAccepted(
        resolveTermsAccepted({
          userId: user?.id,
          profile,
          authPending: loading || profileLoading,
        })
      );
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id, profile, loading, profileLoading]);

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

  if (termsAccepted === null && !pendingTooLong) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner label="Connexion…" />
      </div>
    );
  }

  if (user && !profile && !profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-lg p-5">
          <h1 className="text-lg font-bold text-slate-800">Profil introuvable</h1>
          <p className="mt-2 text-sm text-slate-600">
            La connexion a réussi, mais le profil n’a pas pu être chargé. Vérifiez
            le réseau, puis réessayez.
          </p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-brand-600 text-white py-3 font-semibold"
            onClick={() => void refreshProfile()}
          >
            Réessayer
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-700"
            onClick={() => void signOut()}
          >
            Déconnexion
          </button>
        </div>
      </div>
    );
  }

  if (user && !termsAccepted) {
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
