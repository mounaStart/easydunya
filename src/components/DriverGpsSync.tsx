import { useAuth } from "../hooks/useAuth";
import { useDriverGps } from "../hooks/useDriverGps";

/** Envoie la position GPS du chauffeur pendant tout voyage en cours (toutes pages). */
export default function DriverGpsSync() {
  const { profile } = useAuth();
  const tripId =
    profile?.role === "driver" && profile.driver_status === "approved"
      ? profile.current_trip_id
      : null;

  useDriverGps(tripId ?? undefined, !!tripId);

  return null;
}
