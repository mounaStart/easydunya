import { Capacitor, registerPlugin } from "@capacitor/core";

interface EasyDunyaLocationPlugin {
  isEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  checkPermission(): Promise<{ status: string; enabled?: boolean }>;
  requestPermission(): Promise<{ status: string; enabled?: boolean }>;
  getCurrentPosition(options?: {
    timeout?: number;
    enableHighAccuracy?: boolean;
  }): Promise<{
    ok?: boolean;
    error?: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    timestamp?: number;
  }>;
}

export const EasyDunyaLocation = registerPlugin<EasyDunyaLocationPlugin>("EasyDunyaLocation");

function isNativeLocationPlatform(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

/** Vrai si le GPS système est activé. null = inconnu (web). */
export async function isDeviceLocationEnabled(): Promise<boolean | null> {
  if (!isNativeLocationPlatform()) {
    return null;
  }
  try {
    const { enabled } = await EasyDunyaLocation.isEnabled();
    return enabled;
  } catch {
    return null;
  }
}

/** Ouvre l'écran Localisation (Android) ou Réglages de l'app (iOS). */
export async function openDeviceLocationSettings(): Promise<boolean> {
  if (!isNativeLocationPlatform()) {
    return false;
  }
  try {
    await EasyDunyaLocation.openSettings();
    return true;
  } catch {
    return false;
  }
}

/** Ouvre les paramètres de l'app (autorisation localisation). */
export async function openAppPermissionSettings(): Promise<boolean> {
  if (!isNativeLocationPlatform()) {
    return false;
  }
  try {
    await EasyDunyaLocation.openAppSettings();
    return true;
  } catch {
    return false;
  }
}
