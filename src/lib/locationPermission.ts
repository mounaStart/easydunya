import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import {
  ensureLocationPermission,
  getCurrentPosition,
  geolocationErrorReason,
  type LocationFailReason,
} from "./geocode";

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";
export type { LocationFailReason };

/** État de la permission géolocalisation (sans déclencher la boîte système). */
export async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted") return "granted";
      if (status.location === "denied") return "denied";
      return "prompt";
    } catch {
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

/** Demande la permission puis la position (une seule boîte sur Android). */
export async function requestAppLocation(): Promise<
  { ok: true; position: GeolocationPosition } | { ok: false; reason: LocationFailReason }
> {
  try {
    if (Capacitor.isNativePlatform()) {
      const allowed = await ensureLocationPermission();
      if (!allowed) return { ok: false, reason: "denied" };
    }
    const position = await getCurrentPosition();
    return { ok: true, position };
  } catch (err) {
    return { ok: false, reason: geolocationErrorReason(err) };
  }
}
