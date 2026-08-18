import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App } from "@capacitor/app";
import { isNativePlatform } from "../lib/nativePush";
import { useAuth } from "./useAuth";

/** Écrans « racine » : retour système = quitter l'app. */
function isRootScreen(path: string, isDriver: boolean, isAdmin: boolean): boolean {
  if (path === "/login" || path === "/register") return true;
  if (isAdmin) return path === "/admin";
  if (isDriver) return path === "/" || path === "/driver";
  return path === "/";
}

/**
 * Bouton retour Android / iOS (Capacitor) :
 * navigation in-app (React Router) au lieu de fermer l'APK.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDriver, isAdmin } = useAuth();

  useEffect(() => {
    if (!isNativePlatform()) return;

    let removed = false;
    const sub = App.addListener("backButton", () => {
      const path = location.pathname;

      if (isRootScreen(path, isDriver, isAdmin)) {
        void App.exitApp();
        return;
      }

      const historyIdx = (window.history.state?.idx as number | undefined) ?? 0;
      if (historyIdx > 0) {
        navigate(-1);
        return;
      }

      // Pas d'historique SPA (deep link) → retour à l'accueil du rôle
      if (isAdmin) {
        navigate("/admin", { replace: true });
      } else if (isDriver) {
        navigate("/", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    });

    return () => {
      if (removed) return;
      removed = true;
      void sub.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate, isDriver, isAdmin]);
}
