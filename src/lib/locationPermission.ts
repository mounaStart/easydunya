import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import {
  isDeviceLocationEnabled,
  openDeviceLocationSettings,
} from "./deviceLocationSettings";
import {
  ensureLocationPermission,
  getCurrentPosition,
  geolocationErrorReason,
  isLocationServicesDisabledError,
  type LocationFailReason,
} from "./geocode";

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";
export type { LocationFailReason };

/** État de la permission géolocalisation (sans déclencher la boîte système). */
export async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (Capacitor.isNativePlatform()) {
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
  /** Ouvre les paramètres GPS Android si le GPS système est éteint. */
  openSettingsIfDisabled?: boolean;
}

export type RequestAppLocationResult =
  | { ok: true; position: GeolocationPosition }
  | { ok: false; reason: LocationFailReason; openedSettings?: boolean };

/** Demande la permission puis la position (une seule boîte sur Android). */
export async function requestAppLocation(
  options: RequestAppLocationOptions = {}
): Promise<RequestAppLocationResult> {
  const { openSettingsIfDisabled = false } = options;

  try {
    if (Capacitor.isNativePlatform()) {
      const deviceEnabled = await isDeviceLocationEnabled();
      if (deviceEnabled === false) {
        const openedSettings = openSettingsIfDisabled
          ? await openDeviceLocationSettings()
          : false;
        return { ok: false, reason: "disabled", openedSettings };
      }

      const allowed = await ensureLocationPermission();
      if (!allowed) return { ok: false, reason: "denied" };
    }

    const position = await getCurrentPosition();
    return { ok: true, position };
  } catch (err) {
    const reason = geolocationErrorReason(err);
    if (reason === "disabled" && openSettingsIfDisabled) {
      const openedSettings = await openDeviceLocationSettings();
      return { ok: false, reason, openedSettings };
    }
    return { ok: false, reason };
  }
}
