import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  // L'APK charge le site Netlify en direct : les mises à jour web
  // se propagent sans reconstruire l'APK. Le pont natif (plugins FCM)
  // reste injecté dans la page distante.
  server: {
    url: "https://neon-trifle-a8f4fc.netlify.app",
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
