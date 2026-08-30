import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useDriverGps } from "../hooks/useDriverGps";
import { supabase } from "../lib/supabase";
import type { RoutePoint } from "../lib/routing";

/** Envoie la position GPS du chauffeur pendant tout voyage en cours (toutes pages). */
export default function DriverGpsSync() {
  const { profile, refreshProfile } = useAuth();
  const tripId =
    profile?.role === "driver" &&
    profile.driver_status === "approved" &&
    profile.gps_consent === true
      ? profile.current_trip_id
      : null;

  const [destination, setDestination] = useState<RoutePoint | null>(null);

  useEffect(() => {
    if (!tripId) {
      setDestination(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("trips_public")
      .select("to_lat, to_lng")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        if (Number.isFinite(data.to_lat) && Number.isFinite(data.to_lng)) {
          setDestination({ lat: data.to_lat as number, lng: data.to_lng as number });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  useDriverGps(tripId ?? undefined, !!tripId, () => {
    void refreshProfile();
  }, destination);

  return null;
}
