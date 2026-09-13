import type { CapacitorConfig } from "@capacitor/cli";

/** Site prod Netlify — l'APK / IPA charge cette URL (clés VITE_* = variables Netlify, pas GitHub). */
const NETLIFY_URL = "https://easydunya.netlify.app";

/**
 * CAPACITOR_SERVER_URL :
 * - non défini ou URL → charge le site distant (défaut Netlify, comme avant)
 * - "embedded" → dist/ embarqué dans l'APK / IPA (secrets GitHub VITE_* requis au build)
 */
/** Par défaut : JS embarqué. Netlify seulement si CAPACITOR_SERVER_URL=https://… */
const raw = process.env.CAPACITOR_SERVER_URL?.trim() ?? "embedded";
const useEmbedded = raw === "embedded" || raw === "local" || raw === "";
const remoteUrl = useEmbedded ? "" : (raw.replace(/\/$/, "") || NETLIFY_URL);

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  ...(useEmbedded
    ? {
        server: {
          androidScheme: "https",
          iosScheme: "https",
        },
      }
    : {
        server: {
          url: remoteUrl,
          cleartext: false,
          errorPath: "/offline.html",
        },
      }),
  ios: {
    contentInset: "automatic",
    scheme: "Easy Dunya",
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
