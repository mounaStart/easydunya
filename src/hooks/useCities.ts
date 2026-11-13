import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { filterTripCities } from "../lib/tripCities";
import type { City } from "../lib/types";

export function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("cities")
        .select("*")
        .order("name_fr");
      if (!cancelled) {
        setCities((data as City[] | null) ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tripCities = useMemo(() => filterTripCities(cities), [cities]);

  return { cities, tripCities, loading };
}
