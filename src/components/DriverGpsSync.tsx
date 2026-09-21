import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../hooks/useAuth";
import { useDriverGps, type TripRouteEndpoints } from "../hooks/useDriverGps";
import { supabase } from "../lib/supabase";
import { restSelectOne } from "../lib/supabaseRest";

/** Envoie la position GPS du chauffeur pendant tout voyage en cours (toutes pages). */
export default function DriverGpsSync() {
  const { profile, refreshProfile } = useAuth();
  const tripId =
    profile?.role === "driver" &&
    profile.driver_status === "approved" &&
    profile.gps_consent === true
      ? profile.current_trip_id
      : null;

  const [tripRoute, setTripRoute] = useState<TripRouteEndpoints | null>(null);

  useEffect(() => {
    if (!tripId) {
      setTripRoute(null);
      return;
    }
    const id = tripId;
    let cancelled = false;

    async function loadRoute() {
      const { data } = await restSelectOne<{
        from_lat: number;
        from_lng: number;
        to_lat: number;
        to_lng: number;
      }>("trips_public", {
        select: "from_lat,from_lng,to_lat,to_lng",
        eq: { id },
      });
      if (cancelled || !data) return;
      if (
        Number.isFinite(data.from_lat) &&
        Number.isFinite(data.from_lng) &&
        Number.isFinite(data.to_lat) &&
        Number.isFinite(data.to_lng)
      ) {
        setTripRoute({
          from: { lat: data.from_lat as number, lng: data.from_lng as number },
          to: { lat: data.to_lat as number, lng: data.to_lng as number },
        });
      }
    }

    void loadRoute();
    const refresh = window.setInterval(() => void loadRoute(), 5 * 60_000);

    let removeAppListener: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void loadRoute();
      }).then((h) => {
        removeAppListener = () => void h.remove();
      });
    }

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
      removeAppListener?.();
    };
  }, [tripId]);

  useDriverGps(tripId ?? undefined, !!tripId, () => {
    void refreshProfile();
  }, tripRoute);

  return null;
}
