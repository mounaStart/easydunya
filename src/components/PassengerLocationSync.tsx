import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { queryLocationPermission } from "../lib/locationPermission";
import { isStreetLikeName } from "../lib/geocode";
import { syncPassengerLocation } from "../lib/passengerLocation";

/** Sync passager uniquement si le GPS est déjà autorisé (la bannière gère la 1ère demande). */
export default function PassengerLocationSync() {
  const { user, profile, refreshProfile } = useAuth();
  const syncing = useRef(false);

  async function syncIfAllowed() {
    if (!user || profile?.role !== "passenger" || syncing.current) return;

    const permission = await queryLocationPermission();
    if (permission !== "granted") return;

    syncing.current = true;
    try {
      await syncPassengerLocation(user.id, profile);
      await refreshProfile();
    } finally {
      syncing.current = false;
    }
  }

  useEffect(() => {
    syncIfAllowed();
  }, [user?.id, profile?.role]);

  useEffect(() => {
    if (!user || profile?.role !== "passenger") return;

    function onVisible() {
      if (document.visibilityState !== "visible" || syncing.current || !user) return;
      if (
        profile?.quartier?.trim() &&
        !isStreetLikeName(profile.quartier) &&
        profile.location_lat != null &&
        profile.location_lng != null
      ) {
        return;
      }
      syncIfAllowed();
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id, profile, refreshProfile]);

  return null;
}
