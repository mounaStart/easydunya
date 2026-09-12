import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { getGoogleMapsApiKey } from "./googleMapsLoader";
import { distanceKm } from "./utils";

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type ReversePayload = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
};

/** Quartiers / arrondissements connus de Nouakchott (priorité sur les POI Google). */
const NOUAKCHOTT_QUARTIERS = [
  "Tevragh Zeina",
  "Tevragh-Zeina",
  "Arafat",
  "Dar Naim",
  "Dar Naïm",
  "Toujounine",
  "Teyarett",
  "Ksar",
  "Sebkha",
  "El Mina",
  "Riyad",
  "Las Palmas",
  "Las Palomas",
  "Cinquième",
  "Cinquieme",
  "Kadesh",
  "Tafargh",
  "Toujoune",
];

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 120_000,
};

/** APK Capacitor (y compris WebView Netlify) — pas le navigateur web seul. */
export function useNativeGeolocation(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* ignore */
  }
  const platform = (
    window as Window & { Capacitor?: { getPlatform?: () => string } }
  ).Capacitor?.getPlatform?.();
  return platform === "android" || platform === "ios";
}

async function fetchReverse(lat: number, lng: number): Promise<ReversePayload | null> {
  const key = getGoogleMapsApiKey();
  if (!key) {
    console.warn("[geocode] VITE_GOOGLE_MAPS_API_KEY manquante");
    return null;
  }
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", "fr");
  url.searchParams.set("region", "mr");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: ReversePayload[];
  };
  if (data.status !== "OK" || !data.results?.[0]) return null;
  return data.results[0];
}

function componentsByType(
  components: GoogleAddressComponent[] | undefined,
  ...types: string[]
): string[] {
  if (!components) return [];
  return components
    .filter((c) => types.some((t) => c.types.includes(t)))
    .map((c) => c.long_name);
}

function cityFromPayload(payload: ReversePayload): string | null {
  const parts = componentsByType(
    payload.address_components,
    "locality",
    "administrative_area_level_2",
    "administrative_area_level_1"
  );
  return parts[0] ?? null;
}

function normalizeLabel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[-_]/g, " ");
}

/** Nom de rue / ruelle — pas un quartier (ex. « Rue Mohamed… »). */
export function isStreetLikeName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return /^(rue|r\.|avenue|av\.|boulevard|bd\.|route|chemin|impasse|allée|allee|street|st\.|place|pl\.)/i.test(
    name.trim()
  );
}

/**
 * Labels Google trop précis (carrefour, rond-point, commerce…) — pas un quartier.
 */
export function isUnusableQuartierLabel(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  const n = normalizeLabel(name);
  if (isStreetLikeName(name)) return true;
  if (/^carrefour$/i.test(name.trim())) return true;
  return /^(carrefour|rond[\s-]?point|roundabout|junction|croisement|echangeur|échangeur|station|gare|arret|arrêt|marche|marché|market|supermarche|supermarché|pharmacie|mosquee|mosquée|ecole|école|hopital|hôpital|clinique|banque|restaurant|cafe|café|hotel|hôtel|station[\s-]?service|pharmacy|mosque|school|hospital|stade|parking|terminal|port|aeroport|aéroport)\b/i.test(
    n
  );
}

export function isValidQuartierLabel(name: string | null | undefined): boolean {
  return Boolean(name?.trim()) && !isUnusableQuartierLabel(name);
}

function matchKnownQuartier(candidates: (string | null | undefined)[]): string | null {
  for (const known of NOUAKCHOTT_QUARTIERS) {
    const kn = normalizeLabel(known);
    for (const c of candidates) {
      const label = c?.trim();
      if (!label) continue;
      const ln = normalizeLabel(label);
      if (ln === kn || ln.includes(kn) || kn.includes(ln)) {
        return known.replace("Tevragh-Zeina", "Tevragh Zeina").replace("Dar Naïm", "Dar Naim");
      }
    }
  }
  return null;
}

function addressCandidates(payload: ReversePayload): string[] {
  return componentsByType(
    payload.address_components,
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "sublocality_level_2",
    "administrative_area_level_3",
    "administrative_area_level_4"
  );
}

/**
 * Quartier / arrondissement uniquement (Arafat, Tevragh Zeina…).
 * Exclut rues, carrefours et autres POI.
 */
function extractAreaQuartier(payload: ReversePayload): string | null {
  const candidates = addressCandidates(payload);
  const known = matchKnownQuartier(candidates);
  if (known) return known;
  for (const label of candidates) {
    if (isValidQuartierLabel(label)) return label.trim();
  }
  return null;
}

function pickFromFormattedAddress(formatted?: string): string | null {
  const parts = formatted?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const known = matchKnownQuartier(parts);
  if (known) return known;
  return parts.find((p) => isValidQuartierLabel(p) && !/mauritanie/i.test(p)) ?? null;
}

/** Villes Easy Dunya — repli si le géocodage Google échoue (APK / clé API). */
const MAURITANIA_CITIES = [
  { name: "Nouakchott", lat: 18.0681, lng: -15.97 },
  { name: "Nouadhibou", lat: 20.9456, lng: -17.035 },
  { name: "Rosso", lat: 16.5223, lng: -15.8109 },
  { name: "Boghé", lat: 16.5925, lng: -14.2756 },
  { name: "Kaédi", lat: 16.1487, lng: -13.511 },
  { name: "Aleg", lat: 17.0522, lng: -13.9179 },
  { name: "Kiffa", lat: 16.6167, lng: -11.4144 },
  { name: "Aioun", lat: 16.661, lng: -9.6204 },
  { name: "Néma", lat: 16.6126, lng: -7.2579 },
  { name: "Atar", lat: 20.5146, lng: -13.055 },
  { name: "Zouérat", lat: 22.7268, lng: -12.4786 },
  { name: "Sélibaby", lat: 15.1699, lng: -12.1902 },
  { name: "Tidjikja", lat: 18.5421, lng: -11.4415 },
] as const;

/** True si le libellé correspond à une ville du réseau (pas un quartier). */
export function isMauritaniaCityName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = normalizeLabel(name);
  return MAURITANIA_CITIES.some((city) => normalizeLabel(city.name) === n);
}

/**
 * Quartier enregistrable sur le profil : exclut noms de ville et doublons ville/quartier.
 */
export function normalizeProfileQuartier(
  quartier: string | null | undefined,
  cityName: string | null | undefined
): string | null {
  const q = quartier?.trim();
  if (!q || !isValidQuartierLabel(q) || isMauritaniaCityName(q)) return null;
  const city = cityName?.trim();
  if (city && normalizeLabel(q) === normalizeLabel(city)) return null;
  return q;
}

/** Ville la plus proche (repli hors ligne / géocodage indisponible). */
export function nearestCityName(lat: number, lng: number, maxKm = 120): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { name: string; dist: number } | null = null;
  for (const city of MAURITANIA_CITIES) {
    const dist = distanceKm(lat, lng, city.lat, city.lng);
    if (!best || dist < best.dist) best = { name: city.name, dist };
  }
  return best && best.dist <= maxKm ? best.name : null;
}

/** Reverse geocoding Google : priorité quartier/arrondissement, jamais un POI précis. */
export async function reverseLocation(
  lat: number,
  lng: number
): Promise<{ quartier: string | null; cityName: string | null }> {
  let quartier: string | null = null;
  let cityName: string | null = null;

  try {
    const payload = await fetchReverse(lat, lng);
    if (payload) {
      cityName = cityFromPayload(payload);
      const allCandidates = [
        ...addressCandidates(payload),
        ...(payload.formatted_address?.split(",").map((s) => s.trim()) ?? []),
      ];
      const known = matchKnownQuartier(allCandidates);
      if (known) {
        quartier = known;
      } else {
        const areaQuartier = extractAreaQuartier(payload);
        quartier = areaQuartier ?? pickFromFormattedAddress(payload.formatted_address);
      }
    }
  } catch {
    /* géocodage indisponible — repli ville proche */
  }

  if (!cityName) cityName = nearestCityName(lat, lng);
  quartier = normalizeProfileQuartier(quartier, cityName);
  return { quartier, cityName };
}

export async function reverseQuartier(
  lat: number,
  lng: number
): Promise<string | null> {
  const { quartier } = await reverseLocation(lat, lng);
  return quartier;
}

function toGeolocationPosition(pos: {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}): GeolocationPosition {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON() {
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        };
      },
    },
    timestamp: pos.timestamp,
    toJSON() {
      return {
        coords: this.coords.toJSON(),
        timestamp: this.timestamp,
      };
    },
  };
}

/** Demande la boîte système « Autoriser la localisation » (sans lire la position). */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!useNativeGeolocation()) return true;
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
    // Au clic utilisateur : affiche la fenêtre Android/iOS si possible.
    const requested = await Geolocation.requestPermissions();
    return requested.location === "granted";
  } catch (err) {
    if (isLocationServicesDisabledError(err)) {
      const disabled = new Error("Location services disabled") as Error & { code?: number };
      disabled.code = 2;
      throw disabled;
    }
    throw err;
  }
}

async function getNativePosition(): Promise<GeolocationPosition> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    const err = new Error("Geolocation permission denied") as Error & { code?: number };
    err.code = 1;
    throw err;
  }
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: false,
    timeout: POSITION_OPTIONS.timeout,
    maximumAge: POSITION_OPTIONS.maximumAge,
  });
  return toGeolocationPosition(pos);
}

function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, POSITION_OPTIONS);
  });
}

/**
 * Position actuelle — localisation de l'appareil uniquement (pas de haute précision Google).
 * Une seule boîte système : autoriser la localisation.
 */
export async function getCurrentPosition(): Promise<GeolocationPosition> {
  if (useNativeGeolocation()) {
    return getNativePosition();
  }
  return getBrowserPosition();
}

export type LocationFailReason = "denied" | "timeout" | "disabled" | "unavailable";

function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as Error & { errorMessage?: string; message?: string };
  return String(e.errorMessage ?? e.message ?? "");
}

/** GPS système désactivé ou erreur Capacitor équivalente. */
export function isLocationServicesDisabledError(err: unknown): boolean {
  const text = errorText(err).toLowerCase();
  if (!text) return false;
  return (
    text.includes("location services are not enabled") ||
    text.includes("location service") ||
    text.includes("location disabled") ||
    text.includes("gps disabled") ||
    text.includes("provider disabled")
  );
}

export function geolocationErrorReason(err: unknown): LocationFailReason {
  if (isLocationServicesDisabledError(err)) return "disabled";
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1) return "denied";
  if (code === 3) return "timeout";
  if (code === 2) return "disabled";
  return "unavailable";
}
