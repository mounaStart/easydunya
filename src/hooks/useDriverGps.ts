import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Geolocation } from "@capacitor/geolocation";
import { supabase } from "../lib/supabase";
import { fetchRemainingToDestinationM, type RoutePoint } from "../lib/routing";

export interface TripRouteEndpoints {
  from: RoutePoint;
  to: RoutePoint;
}

const SEND_INTERVAL_MS = 15_000;
const STALE_POSITION_MS = 2 * 60 * 1000;
const PASSENGER_POLL_MS = 10_000;

export interface TripDriverPosition {
  lat: number;
  lng: number;
  recordedAt: Date;
}

export interface DriverGpsPushResult {
  completed?: boolean;
  unlocked?: boolean;
  distance_km?: number;
}

async function pushDriverGps(
  tripId: string,
  lat: number,
  lng: number,
  routeRemainingM?: number | null
): Promise<DriverGpsPushResult | null> {
  const { data, error } = await supabase.rpc("driver_update_gps", {
    p_trip_id: tripId,
    p_lat: lat,
    p_lng: lng,
    p_route_remaining_m: routeRemainingM ?? null,
  });
  if (error) {
    console.warn("[gps] driver_update_gps:", error.message);
    return null;
  }
  return (data as DriverGpsPushResult | null) ?? null;
}

/** Envoie la position GPS du chauffeur pendant un voyage en cours (Web + APK). */
export function useDriverGps(
  tripId: string | undefined,
  active: boolean,
  onCompleted?: (tripId: string) => void,
  tripRoute?: TripRouteEndpoints | null
) {
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const tripRouteRef = useRef(tripRoute);
  tripRouteRef.current = tripRoute;
  const completedRef = useRef(false);
  const watchRef = useRef<string | number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    completedRef.current = false;
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !active) return;

    let cancelled = false;

    async function sendCoords(lat: number, lng: number) {
      if (cancelled || completedRef.current || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      let routeRemainingM: number | null = null;
      const route = tripRouteRef.current;
      if (route) {
        const result = await fetchRemainingToDestinationM({ lat, lng }, route.to);
        routeRemainingM = result.remainingM;
      }
      const result = await pushDriverGps(tripId!, lat, lng, routeRemainingM);
      if (cancelled || !result) return;
      if (result.completed || result.unlocked) {
        completedRef.current = true;
        onCompletedRef.current?.(tripId!);
        window.dispatchEvent(
          new CustomEvent("easydunya:trip-completed", { detail: { tripId: tripId! } })
        );
      }
    }

    async function sendCurrentNative() {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 5_000,
        });
        await sendCoords(pos.coords.latitude, pos.coords.longitude);
      } catch {
        /* position momentanément indisponible */
      }
    }

    async function startNative() {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions();
        if (req.location !== "granted") return;
      }
      await sendCurrentNative();
      watchRef.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 20_000,
          maximumAge: 10_000,
        },
        (pos, err) => {
          if (cancelled || err || !pos) return;
          void sendCoords(pos.coords.latitude, pos.coords.longitude);
        }
      );
      intervalRef.current = window.setInterval(() => {
        void sendCurrentNative();
      }, SEND_INTERVAL_MS);
    }

    function startBrowser() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
      );
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          void sendCoords(pos.coords.latitude, pos.coords.longitude);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
      );
      intervalRef.current = window.setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void sendCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
        );
      }, SEND_INTERVAL_MS);
    }

    if (Capacitor.isNativePlatform()) {
      void startNative();
      const appListener = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void sendCurrentNative();
      });
      return () => {
        cancelled = true;
        void appListener.then((h) => h.remove());
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (watchRef.current !== null) {
          void Geolocation.clearWatch({ id: String(watchRef.current) });
          watchRef.current = null;
        }
      };
    }

    function onVisible() {
      if (document.visibilityState === "visible") {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            void sendCoords(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
        );
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    startBrowser();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current as number);
        watchRef.current = null;
      }
    };
  }, [tripId, active]);
}

/** Position chauffeur + horodatage (temps réel + repli polling). */
export function useTripDriverPosition(
  tripId: string | undefined,
  active: boolean
): TripDriverPosition | null {
  const [pos, setPos] = useState<TripDriverPosition | null>(null);

  useEffect(() => {
    if (!tripId || !active) {
      setPos(null);
      return;
    }
    let cancelled = false;

    async function loadLatest() {
      const { data } = await supabase
        .from("driver_positions")
        .select("latitude, longitude, recorded_at")
        .eq("trip_id", tripId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setPos({
        lat: data.latitude as number,
        lng: data.longitude as number,
        recordedAt: new Date(data.recorded_at as string),
      });
    }

    void loadLatest();

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
          const row = payload.new as {
            latitude: number;
            longitude: number;
            recorded_at: string;
          };
          if (cancelled) return;
          setPos({
            lat: row.latitude,
            lng: row.longitude,
            recordedAt: new Date(row.recorded_at),
          });
        }
      )
      .subscribe();

    const poll = window.setInterval(() => {
      void loadLatest();
    }, PASSENGER_POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") void loadLatest();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [tripId, active]);

  return pos;
}

export function isDriverPositionStale(
  pos: TripDriverPosition | null,
  maxAgeMs = STALE_POSITION_MS
): boolean {
  if (!pos) return false;
  return Date.now() - pos.recordedAt.getTime() > maxAgeMs;
}

export function driverPositionAgeMinutes(pos: TripDriverPosition | null): number | null {
  if (!pos) return null;
  const mins = Math.floor((Date.now() - pos.recordedAt.getTime()) / 60_000);
  return mins >= 1 ? mins : null;
}
