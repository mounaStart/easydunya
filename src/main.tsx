import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";
import SupabaseConfigGate from "./components/SupabaseConfigGate";
import { AuthProvider } from "./hooks/useAuth";
import { GoogleMapsProvider } from "./components/GoogleMapsProvider";
import { initNativeChrome } from "./lib/nativeChrome";
import { disableWebPushOnNative, initNativePush, isNativePlatform } from "./lib/nativePush";
import "./i18n";
import "./index.css";

const AppRouter = isNativePlatform() ? HashRouter : BrowserRouter;

function bootNativeLayer() {
  try {
    disableWebPushOnNative();
    initNativePush();
    void initNativeChrome();
  } catch (err) {
    console.error("[Easy Dunya] init natif:", err);
  }
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Suspense
        fallback={
          <div style={{ padding: 24, fontFamily: "system-ui", background: "#f8fafc", minHeight: "100vh" }}>
            Chargement Easy Dunya…
          </div>
        }
      >
      <AppRouter>
        <AuthProvider>
          <GoogleMapsProvider>
            <SupabaseConfigGate>
              <App />
            </SupabaseConfigGate>
          </GoogleMapsProvider>
        </AuthProvider>
      </AppRouter>
      </Suspense>
    </AppErrorBoundary>
  </React.StrictMode>
);

bootNativeLayer();

// Recharge automatiquement quand une nouvelle version du service worker
// prend le contrôle (navigateur uniquement — pas dans l'APK native).
if (
  "serviceWorker" in navigator &&
  !isNativePlatform() &&
  !/iPad|iPhone|iPod/.test(navigator.userAgent || "")
) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
