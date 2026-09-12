import { useCallback, useEffect, useRef, useState } from "react";
import { useAppRefresh } from "../lib/appRefresh";
import { supabase } from "../lib/supabase";
import type { CityTripCount, TripPublic } from "../lib/types";

interface UseUpcomingTripsArgs {
  cityId?: string | null;
  days?: number;
}

export function useUpcomingTrips({ cityId, days = 7 }: UseUpcomingTripsArgs = {}) {
  const [trips, setTrips] = useState<TripPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    // Début du jour local : inclut les voyages programmés aujourd'hui même si l'heure est passée
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const end = new Date(Date.now() + days * 86400000).toISOString();
    let q = supabase
      .from("trips_public")
      .select("*")
      .eq("status", "scheduled")
      .gt("seats_available", 0)
      .gte("depart_at", startOfToday.toISOString())
      .lte("depart_at", end)
      .order("depart_at", { ascending: true });
    if (cityId) q = q.eq("from_city_id", cityId);

    const { data, error } = await q;
    if (error) setError(error.message);
    setTrips((data as TripPublic[] | null) ?? []);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [cityId, days]);

  useEffect(() => {
    hasLoadedRef.current = false;
    fetch();
    const channel = supabase
      .channel("trips-public-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => fetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetch]);

  useAppRefresh(fetch);

  return { trips, loading, error, refresh: fetch };
}

export function useCityCounts() {
  const [cities, setCities] = useState<CityTripCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("city_trip_counts")
      .select("*")
      .order("name_fr");
    setCities((data as CityTripCount[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) return;
    });
    const channel = supabase
      .channel("city-counts-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        () => load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [load]);

  useAppRefresh(load);

  return { cities, loading };
}

export function useTrip(tripId: string | undefined) {
  const [trip, setTrip] = useState<TripPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("trips_public")
        .select("*")
        .eq("id", tripId)
        .maybeSingle();
      if (!cancelled) {
        setTrip((data as TripPublic | null) ?? null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { trip, loading };
}
