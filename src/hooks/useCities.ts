import { useEffect, useState } from "react";
import { restSelect } from "../lib/supabaseRest";
import type { City } from "../lib/types";

export function useCities() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await restSelect<City>("cities", {
        select: "*",
        order: "name_fr.asc",
      });
      if (!cancelled) {
        setCities(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { cities, loading };
}
