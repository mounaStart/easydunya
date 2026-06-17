import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { syncPassengerLocation } from "../lib/passengerLocation";
import { isStreetLikeName } from "../lib/geocode";

/** À la connexion : enregistre automatiquement quartier + GPS du passager. */
export default function PassengerLocationSync() {
  const { user, profile, refreshProfile } = useAuth();
  const syncing = useRef(false);

  useEffect(() => {
    if (!user || profile?.role !== "passenger" || syncing.current) return;

    syncing.current = true;
    syncPassengerLocation(user.id, profile)
      .then(() => refreshProfile())
      .finally(() => {
        syncing.current = false;
      });
  }, [user?.id, profile?.role, refreshProfile]);

  // Au retour sur l'app : met à jour si quartier ou GPS manquant
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

      syncing.current = true;
      syncPassengerLocation(user.id, profile)
        .then(() => refreshProfile())
        .finally(() => {
          syncing.current = false;
        });
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user?.id, profile, refreshProfile]);

  return null;
}
