import { Geolocation } from "@capacitor/geolocation";
import {
  isDeviceLocationEnabled,
  openAppPermissionSettings,
  openDeviceLocationSettings,
} from "./deviceLocationSettings";
import {
  ensureLocationPermission,
  getCurrentPosition,
  geolocationErrorReason,
  isLocationServicesDisabledError,
  useNativeGeolocation,
  type LocationFailReason,
} from "./geocode";

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";
export type { LocationFailReason };

/** État de la permission géolocalisation (sans déclencher la boîte système). */
export function locationFailMessage(
  reason: LocationFailReason,
  t: (key: string) => string,
  extra?: { openedSettings?: boolean; openedAppSettings?: boolean }
): string {
  switch (reason) {
    case "denied":
      return extra?.openedAppSettings
        ? t("locationPrompt.appSettingsOpened")
        : t("locationPrompt.denied");
    case "timeout":
      return t("locationPrompt.timeout");
    case "disabled":
      return extra?.openedSettings
        ? t("locationPrompt.settingsOpened")
        : t("locationPrompt.disabled");
    default:
      return t("locationPrompt.unavailable");
  }
}

export async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (useNativeGeolocation()) {
    try {
      const deviceEnabled = await isDeviceLocationEnabled();
      if (deviceEnabled === false) return "prompt";

      const status = await Geolocation.checkPermissions();
      if (status.location === "granted") return "granted";
      if (status.location === "denied") return "denied";
      return "prompt";
    } catch (err) {
      if (isLocationServicesDisabledError(err)) return "prompt";
      return "prompt";
    }
  }

  if (!navigator.geolocation) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    // Safari / WebView : pas d'API permissions → on peut quand même demander au clic.
    return "prompt";
  }
}

export interface RequestAppLocationOptions {
  /** Ouvre les paramètres GPS (Android) ou Réglages de l'app (iOS) si le GPS est éteint. */
  openSettingsIfDisabled?: boolean;
  /** Ouvre les paramètres de l'app si la permission a déjà été refusée. */
  openAppSettingsOnDenied?: boolean;
}

export type RequestAppLocationResult =
  | { ok: true; position: GeolocationPosition }
  | {
      ok: false;
      reason: LocationFailReason;
      openedSettings?: boolean;
      openedAppSettings?: boolean;
    };

/** Demande la permission puis la position (fenêtre système au clic). */
export async function requestAppLocation(
  options: RequestAppLocationOptions = {}
): Promise<RequestAppLocationResult> {
  const { openSettingsIfDisabled = false, openAppSettingsOnDenied = false } = options;

  try {
    if (useNativeGeolocation()) {
      // 1. Boîte « Autoriser Easy Dunya à accéder à la position » (priorité au geste utilisateur).
      const allowed = await ensureLocationPermission();
      if (!allowed) {
        const openedAppSettings = openAppSettingsOnDenied
          ? await openAppPermissionSettings()
          : false;
        return { ok: false, reason: "denied", openedAppSettings };
      }

      // 2. GPS système activé ?
      const deviceEnabled = await isDeviceLocationEnabled();
      if (deviceEnabled === false) {
        const openedSettings = openSettingsIfDisabled
          ? await openDeviceLocationSettings()
          : false;
        return { ok: false, reason: "disabled", openedSettings };
      }
    }

    const position = await getCurrentPosition();
    return { ok: true, position };
  } catch (err) {
    const reason = geolocationErrorReason(err);
    if (reason === "disabled" && openSettingsIfDisabled) {
      const openedSettings = await openDeviceLocationSettings();
      return { ok: false, reason, openedSettings };
    }
    if (reason === "denied" && openAppSettingsOnDenied) {
      const openedAppSettings = await openAppPermissionSettings();
      return { ok: false, reason, openedAppSettings };
    }
    return { ok: false, reason };
  }
}
