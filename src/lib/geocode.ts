import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { EasyDunyaLocation } from "./deviceLocationSettings";
import { ensureGoogleMapsLoaded, getGoogleMapsApiKey } from "./googleMapsLoader";
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

function mergeGeocoderResults(results: google.maps.GeocoderResult[]): ReversePayload {
  const seen = new Set<string>();
  const components: GoogleAddressComponent[] = [];

  for (const result of results.slice(0, 6)) {
    for (const c of result.address_components ?? []) {
      const key = `${c.long_name}|${c.types.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      components.push({
        long_name: c.long_name,
        short_name: c.short_name,
        types: [...c.types],
      });
    }
  }

  const preferred =
    results.find((r) =>
      r.address_components?.some((c) =>
        c.types.some((t) =>
          ["neighborhood", "sublocality", "sublocality_level_1", "sublocality_level_2"].includes(t)
        )
      )
    ) ?? results[0];

  return {
    address_components: components,
    formatted_address: preferred.formatted_address,
  };
}

/** Même API que les cartes (Maps JavaScript + Geocoder), pas l'endpoint REST séparé. */
async function fetchReverseViaMapsJs(lat: number, lng: number): Promise<ReversePayload | null> {
  if (!getGoogleMapsApiKey()) {
    console.warn("[geocode] VITE_GOOGLE_MAPS_API_KEY manquante");
    return null;
  }

  try {
    await ensureGoogleMapsLoaded();
  } catch (err) {
    console.warn("[geocode] Google Maps indisponible:", err);
    return null;
  }

  if (!window.google?.maps?.Geocoder) {
    console.warn("[geocode] google.maps.Geocoder indisponible");
    return null;
  }

  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode(
      { location: { lat, lng }, language: "fr", region: "MR" },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
          if (status !== google.maps.GeocoderStatus.ZERO_RESULTS) {
            console.warn("[geocode] Geocoder status:", status);
          }
          resolve(null);
          return;
        }
        resolve(mergeGeocoderResults(results));
      }
    );
  });
}

async function fetchReverse(lat: number, lng: number): Promise<ReversePayload | null> {
  return fetchReverseViaMapsJs(lat, lng);
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

/** Libellés administratifs Google (ex. « La Capitale ») — pas un quartier. */
export function isGenericAreaLabel(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const n = normalizeLabel(name);
  return (
    n === "la capitale" ||
    n === "the capital" ||
    n === "capitale" ||
    n === "capital" ||
    n === "centre ville" ||
    n === "city center" ||
    n === "downtown" ||
    n === "centre" ||
    n === "mauritanie" ||
    n.startsWith("wilaya ") ||
    n.startsWith("region ") ||
    n.startsWith("arrondissement ")
  );
}

/** Code Plus Google (ex. 22QQ+VFV) — pas un nom de quartier lisible. */
export function isPlusCode(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const token = name.trim().split(/\s+/)[0] ?? "";
  return /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,4}$/i.test(token);
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
  if (isPlusCode(name)) return true;
  if (isGenericAreaLabel(name)) return true;
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
  ).filter((label) => !isPlusCode(label));
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
  return (
    parts.find(
      (p) => isValidQuartierLabel(p) && !/mauritanie/i.test(p) && !isPlusCode(p)
    ) ?? null
  );
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

/** Noms de ville canoniques FR + AR (alignés sur la table cities). */
const CITY_LOCALIZED: Record<string, { fr: string; ar: string }> = {
  nouakchott: { fr: "Nouakchott", ar: "نواكشوط" },
  nouadhibou: { fr: "Nouadhibou", ar: "نواذيبو" },
  rosso: { fr: "Rosso", ar: "روصو" },
  boghe: { fr: "Boghé", ar: "بوغي" },
  kaedi: { fr: "Kaédi", ar: "كيهيدي" },
  aleg: { fr: "Aleg", ar: "ألاك" },
  kiffa: { fr: "Kiffa", ar: "كيفا" },
  aioun: { fr: "Aioun", ar: "العيون" },
  nema: { fr: "Néma", ar: "النعمة" },
  atar: { fr: "Atar", ar: "أطار" },
  zouerat: { fr: "Zouérat", ar: "الزويرات" },
  selibaby: { fr: "Sélibaby", ar: "سيليبابي" },
  tidjikja: { fr: "Tidjikja", ar: "تجكجة" },
};

function cityLookupKey(name: string): string | null {
  const trimmed = name.trim();
  const n = normalizeLabel(trimmed);
  for (const [key, labels] of Object.entries(CITY_LOCALIZED)) {
    if (normalizeLabel(labels.fr) === n || labels.ar === trimmed) return key;
  }
  for (const city of MAURITANIA_CITIES) {
    if (normalizeLabel(city.name) === n) return normalizeLabel(city.name);
  }
  return null;
}

/** Nom ville en français pour la base (toujours cohérent). */
export function canonicalCityNameFr(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const key = cityLookupKey(raw);
  if (key && CITY_LOCALIZED[key]) return CITY_LOCALIZED[key].fr;
  return raw.trim();
}

/** Affichage ville selon la langue de l'app. */
export function formatCityLabel(raw: string | null | undefined, locale: string): string | null {
  if (!raw?.trim()) return null;
  const key = cityLookupKey(raw);
  if (key && CITY_LOCALIZED[key]) {
    return locale.startsWith("ar") ? CITY_LOCALIZED[key].ar : CITY_LOCALIZED[key].fr;
  }
  return raw.trim();
}

/** Repères GPS des arrondissements de Nouakchott (OSM / entrées ville Easy Dunya). */
const NOUAKCHOTT_QUARTIER_ANCHORS = [
  { name: "Arafat", lat: 18.0462, lng: -15.9183 },
  { name: "Tevragh Zeina", lat: 18.0954, lng: -15.9761 },
  { name: "Dar Naim", lat: 18.085, lng: -15.905 },
  { name: "Toujounine", lat: 18.115, lng: -15.935 },
  { name: "Ksar", lat: 18.09, lng: -15.95 },
  { name: "Sebkha", lat: 18.055, lng: -15.965 },
  { name: "El Mina", lat: 18.035, lng: -15.945 },
  { name: "Teyarett", lat: 18.075, lng: -15.935 },
  { name: "Riyad", lat: 18.05, lng: -15.955 },
  { name: "Las Palmas", lat: 18.1, lng: -15.955 },
  { name: "Cinquième", lat: 18.062, lng: -15.9498 },
] as const;

const NOUAKCHOTT_BOUNDS = {
  minLat: 17.95,
  maxLat: 18.15,
  minLng: -16.05,
  maxLng: -15.85,
};

export function isInNouakchottArea(lat: number, lng: number): boolean {
  return (
    lat >= NOUAKCHOTT_BOUNDS.minLat &&
    lat <= NOUAKCHOTT_BOUNDS.maxLat &&
    lng >= NOUAKCHOTT_BOUNDS.minLng &&
    lng <= NOUAKCHOTT_BOUNDS.maxLng
  );
}

/** Quartier Nouakchott le plus proche des coordonnées GPS (si Google ne renvoie que la ville). */
export function nearestNouakchottQuartier(lat: number, lng: number, maxKm = 14): string | null {
  if (!isInNouakchottArea(lat, lng)) return null;
  let best: { name: string; dist: number } | null = null;
  for (const anchor of NOUAKCHOTT_QUARTIER_ANCHORS) {
    const dist = distanceKm(lat, lng, anchor.lat, anchor.lng);
    if (dist <= maxKm && (!best || dist < best.dist)) {
      best = { name: anchor.name, dist };
    }
  }
  return best?.name ?? null;
}

/** True si le libellé correspond à une ville du réseau (FR, AR — pas un quartier). */
export function isMauritaniaCityName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return cityLookupKey(name) !== null;
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
  cityName = canonicalCityNameFr(cityName) ?? cityName;

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

async function ensureIosCoreLocationPermission(): Promise<boolean | null> {
  try {
    const current = await EasyDunyaLocation.checkPermission();
    if (current.status === "granted") return true;
    const requested = await EasyDunyaLocation.requestPermission();
    if (requested.enabled === false) {
      const disabled = new Error("Location services disabled") as Error & { code?: number };
      disabled.code = 2;
      throw disabled;
    }
    return requested.status === "granted";
  } catch (err) {
    if (isLocationServicesDisabledError(err)) throw err;
    return null;
  }
}

/** Demande la boîte système « Autoriser la localisation » (sans lire la position). */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!useNativeGeolocation()) return true;
  if (Capacitor.getPlatform() === "ios") {
    const ios = await ensureIosCoreLocationPermission();
    if (ios !== null) return ios;
  }
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
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

const ACCURATE_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 25_000,
  maximumAge: 0,
};

async function getIosCoreLocationPosition(
  options: PositionOptions
): Promise<GeolocationPosition | null> {
  if (Capacitor.getPlatform() !== "ios") return null;
  try {
    const pos = await EasyDunyaLocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? false,
      timeout: options.timeout ?? POSITION_OPTIONS.timeout,
    });
    if (!Number.isFinite(pos.latitude) || !Number.isFinite(pos.longitude)) return null;
    return toGeolocationPosition({
      coords: {
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy || 0,
      },
      timestamp: pos.timestamp || Date.now(),
    });
  } catch (err) {
    if (isLocationServicesDisabledError(err)) throw err;
    const text = String((err as Error)?.message ?? err).toLowerCase();
    if (text.includes("denied")) {
      const denied = new Error("Geolocation permission denied") as Error & { code?: number };
      denied.code = 1;
      throw denied;
    }
    return null;
  }
}

async function getNativePosition(options: PositionOptions = POSITION_OPTIONS): Promise<GeolocationPosition> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    const err = new Error("Geolocation permission denied") as Error & { code?: number };
    err.code = 1;
    throw err;
  }
  const iosPos = await getIosCoreLocationPosition(options);
  if (iosPos) return iosPos;
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? false,
      timeout: options.timeout ?? POSITION_OPTIONS.timeout,
      maximumAge: options.maximumAge ?? POSITION_OPTIONS.maximumAge,
    });
    return toGeolocationPosition(pos);
  } catch (err) {
    if (Capacitor.getPlatform() === "ios") {
      return getBrowserPosition(options);
    }
    throw err;
  }
}

function getBrowserPosition(options: PositionOptions = POSITION_OPTIONS): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Position actuelle. `accurate: true` pour le profil passager (GPS frais, haute précision).
 */
export async function getCurrentPosition(options?: {
  accurate?: boolean;
}): Promise<GeolocationPosition> {
  const opts = options?.accurate ? ACCURATE_POSITION_OPTIONS : POSITION_OPTIONS;
  if (useNativeGeolocation()) {
    return getNativePosition(opts);
  }
  return getBrowserPosition(opts);
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
  const text = errorText(err).toLowerCase();
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1 || text.includes("denied")) return "denied";
  if (code === 3 || text.includes("timeout")) return "timeout";
  if (code === 2) return "disabled";
  return "unavailable";
}
