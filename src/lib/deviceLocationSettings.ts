import { Capacitor, registerPlugin } from "@capacitor/core";

interface EasyDunyaLocationPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
}

const EasyDunyaLocation = registerPlugin<EasyDunyaLocationPlugin>("EasyDunyaLocation");

/** Vrai si le GPS système Android est activé. null = inconnu (web / iOS). */
export async function isDeviceLocationEnabled(): Promise<boolean | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return null;
  }
  try {
    const { enabled } = await EasyDunyaLocation.isEnabled();
    return enabled;
  } catch {
    return null;
  }
}

/** Ouvre l'écran « Localisation » des paramètres Android. */
export async function openDeviceLocationSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return false;
  }
  try {
    await EasyDunyaLocation.openSettings();
    return true;
  } catch {
    return false;
  }
}
