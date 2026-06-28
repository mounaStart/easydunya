import type { CapacitorConfig } from "@capacitor/cli";

/** URL Netlify liée à GitHub (Site configuration → Domain management). */
const NETLIFY_URL =
  process.env.CAPACITOR_SERVER_URL?.replace(/\/$/, "") ||
  "https://easydunya.netlify.app";

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  // Charge le site Netlify (toujours à jour + variables d'env correctes).
  // L'icône et le FCM natif restent dans la couche Android.
  server: {
    url: NETLIFY_URL,
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
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
