import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { initNativePush, isNativePlatform } from "./lib/nativePush";
import "./i18n";
import "./index.css";

// Initialise les listeners FCM dès le démarrage (avant connexion).
initNativePush();

// Le service worker PWA (web-push) perturbe FCM natif dans l'APK.
if (isNativePlatform() && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

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
