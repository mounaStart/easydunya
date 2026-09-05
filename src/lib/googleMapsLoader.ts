import { useEffect, useState } from "react";

let loadState: "idle" | "loading" | "ready" | "error" = "idle";
let loadError: Error | undefined;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Format attendu : clé API Google (Commence par AIzaSy…). */
export function isValidGoogleMapsApiKey(key: string): boolean {
  return /^AIzaSy[A-Za-z0-9_-]{20,}$/.test(key.trim());
}

export function getGoogleMapsApiKey(): string | undefined {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return typeof key === "string" && key.trim() ? key.trim() : undefined;
}

function waitForGoogleMapsApi(maxAttempts = 50): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      if (window.google?.maps?.Map) {
        resolve();
        return;
      }
      if (++attempts >= maxAttempts) {
        reject(new Error("Google Maps API indisponible (activez Maps JavaScript API)."));
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

/** Charge Google Maps sans auth_referrer_policy=origin (compatible referrers localhost). */
export function ensureGoogleMapsLoaded(): Promise<void> {
  if (loadState === "ready") return Promise.resolve();
  if (loadPromise) return loadPromise;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    loadError = new Error("VITE_GOOGLE_MAPS_API_KEY manquante dans .env");
    loadState = "error";
    notify();
    return Promise.reject(loadError);
  }
  if (!isValidGoogleMapsApiKey(apiKey)) {
    loadError = new Error("Clé Google invalide — utilisez Clé API 5 (AIzaSy…).");
    loadState = "error";
    notify();
    return Promise.reject(loadError);
  }

  loadState = "loading";
  notify();

  loadPromise = new Promise((resolve, reject) => {
    window.gm_authFailure = () => {
      const err = new Error(
        "Google Maps a refusé la clé. Google Cloud → referrers : http://localhost:5173/* , https://easydunya.netlify.app/* , https://localhost/* (APK Capacitor) — Maps JavaScript API + facturation."
      );
      loadError = err;
      loadState = "error";
      notify();
      reject(err);
    };

    if (window.google?.maps?.Map) {
      loadState = "ready";
      notify();
      resolve();
      return;
    }

    const id = "easydunya-google-maps-js";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        waitForGoogleMapsApi().then(() => {
          loadState = "ready";
          notify();
          resolve();
        }).catch(reject);
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    // Pas de auth_referrer_policy=origin : le referer complet localhost:5173/ est envoyé.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=fr&region=MR&loading=async`;
    script.onload = () => {
      waitForGoogleMapsApi()
        .then(() => {
          loadState = "ready";
          notify();
          resolve();
        })
        .catch((err) => {
          loadError = err instanceof Error ? err : new Error(String(err));
          loadState = "error";
          notify();
          reject(loadError);
        });
    };
    script.onerror = () => {
      loadError = new Error("Impossible de charger maps.googleapis.com (réseau ou clé bloquée).");
      loadState = "error";
      notify();
      reject(loadError);
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Hook React — une seule instance de script Google Maps pour toute l'app. */
export function useGoogleMapsScript() {
  const [, tick] = useState(0);

  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    listeners.add(refresh);
    void ensureGoogleMapsLoaded().catch(() => {});
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  return {
    isLoaded: loadState === "ready",
    loadError,
  };
}

declare global {
  interface Window {
    google?: { maps?: { Map?: unknown; SymbolPath?: { CIRCLE: unknown }; event?: unknown; LatLngBounds?: unknown } };
    gm_authFailure?: () => void;
  }
}
