import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { locationFailMessage, requestAppLocation } from "../lib/locationPermission";
import { distanceKm } from "../lib/utils";

/** Rayon du filtre optionnel « passagers les plus proches ». */
export const NEAREST_PASSENGER_RADIUS_KM = 20;

export type GeoPos = { lat: number; lng: number };

/** Filtre GPS optionnel : le chauffeur clique s’il veut ne voir que les plus proches. */
export function useNearestPassengerFilter(liveDriverPos: GeoPos | null) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [manualOrigin, setManualOrigin] = useState<GeoPos | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = enabled ? liveDriverPos ?? manualOrigin : null;

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      setError(null);
      return;
    }
    if (liveDriverPos) {
      setManualOrigin(liveDriverPos);
      setError(null);
      setEnabled(true);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestAppLocation({
      openSettingsIfDisabled: true,
      openAppSettingsOnDenied: true,
    });
    setBusy(false);
    if (!result.ok) {
      setError(
        locationFailMessage(result.reason, t, {
          openedSettings: result.openedSettings,
          openedAppSettings: result.openedAppSettings,
        })
      );
      return;
    }
    setManualOrigin({
      lat: result.position.coords.latitude,
      lng: result.position.coords.longitude,
    });
    setEnabled(true);
  }, [enabled, liveDriverPos, t]);

  return {
    enabled,
    busy,
    error,
    origin,
    toggle,
    radiusKm: NEAREST_PASSENGER_RADIUS_KM,
  };
}

export function rankByDistance<T extends { lat: number; lng: number }>(
  items: T[],
  origin: GeoPos | null
): Array<T & { distKm: number | null }> {
  if (!origin) {
    return items.map((item) => ({ ...item, distKm: null }));
  }
  return items
    .map((item) => ({
      ...item,
      distKm: distanceKm(origin.lat, origin.lng, item.lat, item.lng),
    }))
    .sort((a, b) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity));
}

export function nearbyOnly<T extends { distKm: number | null }>(
  ranked: T[],
  enabled: boolean,
  radiusKm = NEAREST_PASSENGER_RADIUS_KM
): T[] {
  if (!enabled) return ranked;
  return ranked.filter((item) => item.distKm != null && item.distKm <= radiusKm);
}

export function bookingDistanceKm(
  origin: GeoPos,
  pickupLat: number | null | undefined,
  pickupLng: number | null | undefined
): number | null {
  if (pickupLat == null || pickupLng == null) return null;
  return distanceKm(origin.lat, origin.lng, pickupLat, pickupLng);
}
