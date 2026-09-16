import { useCallback, useEffect, useRef, useState } from "react";
import { useAppRefresh } from "../lib/appRefresh";
import { supabase } from "../lib/supabase";
import { restSelect, restSelectOne } from "../lib/supabaseRest";
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
    const { data, error } = await restSelect<TripPublic>("trips_public", {
      select: "*",
      eq: {
        status: "scheduled",
        ...(cityId ? { from_city_id: cityId } : {}),
      },
      gt: { seats_available: 0 },
      gte: { depart_at: startOfToday.toISOString() },
      lte: { depart_at: end },
      order: "depart_at.asc",
    });
    if (error) setError(error);
    setTrips(data);
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
    const { data } = await restSelect<CityTripCount>("city_trip_counts", {
      select: "*",
      order: "name_fr.asc",
    });
    setCities(data);
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
    const id = tripId;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await restSelectOne<TripPublic>("trips_public", {
        select: "*",
        eq: { id },
      });
      if (!cancelled) {
        setTrip(data);
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
