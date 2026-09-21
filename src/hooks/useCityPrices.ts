import { useCallback, useEffect, useState } from "react";
import { restSelect } from "../lib/supabaseRest";
import type { CityPrice } from "../lib/types";

export function useCityPrices() {
  const [prices, setPrices] = useState<CityPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await restSelect<CityPrice>("city_prices", {
      select: "*",
      order: "created_at.desc",
    });
    setPrices(data);
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
