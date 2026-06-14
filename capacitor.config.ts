import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  // Le code web est embarqué dans l'APK (build CI).
  // Cela garantit que les plugins natifs (FCM) fonctionnent correctement.
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
