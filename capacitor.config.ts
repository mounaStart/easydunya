import type { CapacitorConfig } from "@capacitor/cli";

/**
 * URL distante optionnelle (ex. preview Netlify).
 * Vide par défaut → l'APK embarque dist/ (clés VITE_* du build GitHub Actions).
 * Ne pas forcer Netlify : sans VITE_GOOGLE_MAPS_API_KEY côté Netlify la carte APK reste grise.
 */
const REMOTE_URL = process.env.CAPACITOR_SERVER_URL?.trim().replace(/\/$/, "") ?? "";

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  ...(REMOTE_URL
    ? {
        server: {
          url: REMOTE_URL,
          cleartext: false,
          errorPath: "/offline.html",
        },
      }
    : {}),
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound"],
    },
    SystemBars: {
      insetsHandling: "css",
      style: "DEFAULT",
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "DARK",
    },
  },
};

export default config;
