import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.easydunya",
  appName: "Easy Dunya",
  webDir: "dist",
  // Charge le site Netlify (toujours à jour + variables d'env correctes).
  // L'icône et le FCM natif restent dans la couche Android.
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
