import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { CityPrice } from "../lib/types";

export function useCityPrices() {
  const [prices, setPrices] = useState<CityPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("city_prices")
      .select("*")
      .order("created_at", { ascending: false });
    setPrices((data as CityPrice[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { prices, loading, refresh: load };
}

/** Commission EasyDunya : >100 km → 6 % par siège, sinon 100 MRU forfait. */
export function computeCommission(
  distanceKm: number,
  pricePerSeat: number,
  seats: number
): number {
  if (distanceKm > 100) {
    return Math.round(pricePerSeat * 0.06) * Math.max(seats, 1);
  }
  return 100;
}
