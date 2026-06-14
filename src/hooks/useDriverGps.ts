import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { LatLng } from "../components/TrackingMap";

/** Envoie la position GPS du chauffeur pendant un voyage en cours. */
export function useDriverGps(tripId: string | undefined, active: boolean) {
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!tripId || !active || !navigator.geolocation) return;

    async function send(pos: GeolocationPosition) {
      await supabase.rpc("driver_update_gps", {
        p_trip_id: tripId,
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
      });
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => { send(pos); },
      () => { /* permission refusée */ },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [tripId, active]);
}

/** Lit la dernière position GPS connue du chauffeur pour un voyage (temps réel). */
export function useTripDriverPosition(
  tripId: string | undefined,
  active: boolean
): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!tripId || !active) {
      setPos(null);
      return;
    }
    let cancelled = false;

    async function loadLatest() {
      const { data } = await supabase
        .from("driver_positions")
        .select("latitude, longitude")
        .eq("trip_id", tripId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) {
        setPos({ lat: data.latitude as number, lng: data.longitude as number });
      }
    }
    loadLatest();

    const channel = supabase
      .channel(`track-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_positions",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const row = payload.new as { latitude: number; longitude: number };
          if (!cancelled) setPos({ lat: row.latitude, lng: row.longitude });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tripId, active]);

  return pos;
}
