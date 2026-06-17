type OsmAddress = {
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  district?: string;
  borough?: string;
  county?: string;
  hamlet?: string;
  village?: string;
  road?: string;
  amenity?: string;
  town?: string;
  city?: string;
  municipality?: string;
  state?: string;
};

type ReversePayload = {
  address?: OsmAddress;
  display_name?: string;
};

async function fetchReverse(
  lat: number,
  lng: number,
  zoom: number
): Promise<ReversePayload | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr&zoom=${zoom}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "EasyDunya/1.0" },
  });
  if (!res.ok) return null;
  return (await res.json()) as ReversePayload;
}

function cityFromAddress(a?: OsmAddress): string | null {
  if (!a) return null;
  return a.city ?? a.town ?? a.municipality ?? a.state ?? null;
}

/** Extrait le quartier : rue/lieu d'abord, arrondissement OSM (ex. Arafat) en secours. */
function extractQuartier(a?: OsmAddress, allowCounty = false): string | null {
  if (!a) return null;
  const primary =
    a.suburb ??
    a.neighbourhood ??
    a.quarter ??
    a.city_district ??
    a.district ??
    a.borough ??
    a.hamlet ??
    a.village ??
    a.road ??
    a.amenity ??
    null;
  if (primary?.trim()) return primary.trim();
  if (allowCounty && a.county?.trim()) return a.county.trim();
  return null;
}

/** Reverse geocoding via Nominatim (OpenStreetMap), multi-zoom pour Nouakchott. */
export async function reverseLocation(
  lat: number,
  lng: number
): Promise<{ quartier: string | null; cityName: string | null }> {
  try {
    // 1) Rue / lieu précis (ex. Tevragh Zeina → nom de rue plutôt que l'arrondissement)
    const fine = await fetchReverse(lat, lng, 18);
    const fineQuartier = extractQuartier(fine?.address, false);
    const cityName =
      cityFromAddress(fine?.address) ??
      cityFromAddress((await fetchReverse(lat, lng, 14))?.address) ??
      null;
    if (fineQuartier) return { quartier: fineQuartier, cityName };

    // 2) Secteur / carrefour (ex. Carrefour, Arafatt Secteur 1…)
    const area = await fetchReverse(lat, lng, 14);
    const areaQuartier = extractQuartier(area?.address, true);
    if (areaQuartier) {
      return {
        quartier: areaQuartier,
        cityName: cityName ?? cityFromAddress(area?.address),
      };
    }

    // 3) Arrondissement (ex. Arafat quand zoom 18 n'a que county)
    const wide = await fetchReverse(lat, lng, 12);
    const wideQuartier = extractQuartier(wide?.address, true);
    if (wideQuartier) {
      return {
        quartier: wideQuartier,
        cityName: cityName ?? cityFromAddress(wide?.address),
      };
    }

    const parts =
      fine?.display_name?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    return {
      quartier: parts[0] ?? null,
      cityName:
        cityName ??
        parts.find((p) => !/mauritanie/i.test(p)) ??
        parts[1] ??
        null,
    };
  } catch {
    return { quartier: null, cityName: null };
  }
}

export async function reverseQuartier(
  lat: number,
  lng: number
): Promise<string | null> {
  const { quartier } = await reverseLocation(lat, lng);
  return quartier;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
    });
  });
}
