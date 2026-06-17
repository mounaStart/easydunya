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

/** Nom de rue / ruelle — pas un quartier (ex. « Rue Mohamed… »). */
export function isStreetLikeName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return /^(rue|r\.|avenue|av\.|boulevard|bd\.|route|chemin|impasse|allée|allee|street|st\.|place|pl\.)/i.test(
    name.trim()
  );
}

/**
 * Quartier / arrondissement uniquement (Arafat, Tevragh Zeina…).
 * Exclut les rues retournées par Nominatim au zoom élevé.
 */
function extractAreaQuartier(a?: OsmAddress, allowCounty = false): string | null {
  if (!a) return null;
  const candidates = [
    a.suburb,
    a.neighbourhood,
    a.quarter,
    a.city_district,
    a.district,
    a.borough,
    ...(allowCounty ? [a.county] : []),
    a.hamlet,
    a.village,
  ];
  for (const c of candidates) {
    const label = c?.trim();
    if (label && !isStreetLikeName(label)) return label;
  }
  return null;
}

/** Reverse geocoding : priorité arrondissement/quartier, jamais une rue en premier. */
export async function reverseLocation(
  lat: number,
  lng: number
): Promise<{ quartier: string | null; cityName: string | null }> {
  try {
    const area = await fetchReverse(lat, lng, 14);
    const areaQuartier = extractAreaQuartier(area?.address, true);
    const cityName =
      cityFromAddress(area?.address) ??
      cityFromAddress((await fetchReverse(lat, lng, 12))?.address) ??
      null;

    if (areaQuartier) return { quartier: areaQuartier, cityName };

    const wide = await fetchReverse(lat, lng, 12);
    const wideQuartier = extractAreaQuartier(wide?.address, true);
    if (wideQuartier) {
      return {
        quartier: wideQuartier,
        cityName: cityName ?? cityFromAddress(wide?.address),
      };
    }

    const mid = await fetchReverse(lat, lng, 16);
    const midQuartier = extractAreaQuartier(mid?.address, false);
    if (midQuartier) {
      return {
        quartier: midQuartier,
        cityName: cityName ?? cityFromAddress(mid?.address),
      };
    }

    const parts =
      area?.display_name?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
    const fromDisplay = parts.find((p) => !isStreetLikeName(p) && !/mauritanie/i.test(p));
    return {
      quartier: fromDisplay ?? null,
      cityName: cityName ?? parts.find((p) => !/mauritanie/i.test(p)) ?? null,
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

export function geolocationErrorReason(err: unknown): "denied" | "unavailable" {
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1) return "denied";
  return "unavailable";
}
