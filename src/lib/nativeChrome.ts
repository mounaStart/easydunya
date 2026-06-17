import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { isNativePlatform } from "./nativePush";

/** Barre de statut + safe area (APK) pour ne pas chevaucher le header. */
export async function initNativeChrome(): Promise<void> {
  if (!isNativePlatform()) return;
  document.documentElement.classList.add("native-app");

  try {
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
  } catch {
    /* SystemBars indisponible sur cette version */
  }

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: "#ffffff" });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    /* le CSS --safe-area-inset-* prend le relais */
  }
}
