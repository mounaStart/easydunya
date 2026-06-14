/** Reverse geocoding via Nominatim (OpenStreetMap). */
export async function reverseQuartier(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fr`;
    const res = await fetch(url, {
      headers: { "User-Agent": "EasyDunya/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        suburb?: string;
        neighbourhood?: string;
        quarter?: string;
        city_district?: string;
        village?: string;
        town?: string;
      };
      display_name?: string;
    };
    const a = data.address;
    if (!a) return data.display_name?.split(",")[0] ?? null;
    return (
      a.suburb ??
      a.neighbourhood ??
      a.quarter ??
      a.city_district ??
      a.village ??
      a.town ??
      null
    );
  } catch {
    return null;
  }
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
