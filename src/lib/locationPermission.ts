import { getCurrentPosition, geolocationErrorReason } from "./geocode";

export type LocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

/** État de la permission géolocalisation (sans déclencher la boîte système). */
export async function queryLocationPermission(): Promise<LocationPermissionState> {
  if (!navigator.geolocation) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
  }
}

/** Demande la position (ouvre la boîte système Android/iOS si besoin). */
export async function requestAppLocation(): Promise<
  { ok: true; position: GeolocationPosition } | { ok: false; reason: "denied" | "unavailable" }
> {
  try {
    const position = await getCurrentPosition();
    return { ok: true, position };
  } catch (err) {
    return { ok: false, reason: geolocationErrorReason(err) };
  }
}
