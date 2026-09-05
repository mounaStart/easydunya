import type { City, CityPrice } from "./types";
import type { RoutePoint } from "./routing";

/** Centre-ville (carte accueil, recherche). */
export function cityMapCenter(city: Pick<City, "latitude" | "longitude">): RoutePoint {
  return { lat: city.latitude, lng: city.longitude };
}

/** Entrée routière par défaut de la ville. */
export function cityEntryPoint(
  city: Pick<City, "latitude" | "longitude" | "entry_lat" | "entry_lng">
): RoutePoint {
  if (Number.isFinite(city.entry_lat) && Number.isFinite(city.entry_lng)) {
    return { lat: city.entry_lat!, lng: city.entry_lng! };
  }
  return cityMapCenter(city);
}

/** Point départ/arrivée sur la route (paire tarifaire > entrée ville > centre). */
export function tripRouteEndpoint(
  city: Pick<City, "latitude" | "longitude" | "entry_lat" | "entry_lng">,
  cityPrice: Pick<
    CityPrice,
    "from_entrance_lat" | "from_entrance_lng" | "to_entrance_lat" | "to_entrance_lng"
  > | null | undefined,
  leg: "from" | "to"
): RoutePoint {
  if (cityPrice) {
    if (
      leg === "from" &&
      Number.isFinite(cityPrice.from_entrance_lat) &&
      Number.isFinite(cityPrice.from_entrance_lng)
    ) {
      return { lat: cityPrice.from_entrance_lat!, lng: cityPrice.from_entrance_lng! };
    }
    if (
      leg === "to" &&
      Number.isFinite(cityPrice.to_entrance_lat) &&
      Number.isFinite(cityPrice.to_entrance_lng)
    ) {
      return { lat: cityPrice.to_entrance_lat!, lng: cityPrice.to_entrance_lng! };
    }
  }
  return cityEntryPoint(city);
}
