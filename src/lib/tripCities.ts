import type { City } from "./types";

function normalizeCityName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[-'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quartiers / arrondissements enregistrés à tort dans `cities` (ex. Tevragh Zeina). */
const QUARTIER_CITY_NAMES = new Set([
  "tevragh zeina",
  "arafat",
  "dar naim",
  "toujounine",
  "teyarett",
  "ksar",
  "sebkha",
  "el mina",
  "riyad",
  "las palmas",
  "las palomas",
  "cinquieme",
  "kadesh",
  "tafargh",
  "toujoune",
]);

export function isQuartierCity(city: Pick<City, "name_fr" | "region">): boolean {
  const name = normalizeCityName(city.name_fr);
  if (QUARTIER_CITY_NAMES.has(name)) return true;
  const region = normalizeCityName(city.region ?? "");
  return region === "nouakchott" && name !== "nouakchott";
}

/** Villes interurbaines uniquement (pas les quartiers de Nouakchott). */
export function filterTripCities<T extends Pick<City, "name_fr" | "region">>(cities: T[]): T[] {
  return cities.filter((c) => !isQuartierCity(c));
}
