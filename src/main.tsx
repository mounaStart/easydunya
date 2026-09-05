import React from "react";
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
      <AppRouter>
        <AuthProvider>
          <GoogleMapsProvider>
            <SupabaseConfigGate>
              <App />
            </SupabaseConfigGate>
          </GoogleMapsProvider>
        </AuthProvider>
      </AppRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);

bootNativeLayer();

// Recharge automatiquement quand une nouvelle version du service worker
// prend le contrôle (navigateur uniquement — pas dans l'APK native).
if ("serviceWorker" in navigator && !isNativePlatform()) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
