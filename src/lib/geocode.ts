import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

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

/** Quartiers / arrondissements connus de Nouakchott (priorité sur les POI OSM). */
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
 * Labels OSM trop précis (carrefour, rond-point, commerce…) — pas un quartier.
 * « Carrefour » = rond-point en français OSM, pas le supermarché.
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

function addressCandidates(a?: OsmAddress): string[] {
  if (!a) return [];
  return [
    a.suburb,
    a.neighbourhood,
    a.quarter,
    a.city_district,
    a.district,
    a.borough,
    a.county,
    a.hamlet,
    a.village,
    a.municipality,
    a.city,
    a.town,
  ].filter((x): x is string => Boolean(x?.trim()));
}

/**
 * Quartier / arrondissement uniquement (Arafat, Tevragh Zeina…).
 * Exclut rues, carrefours et autres POI.
 */
function extractAreaQuartier(a?: OsmAddress, allowCounty = false): string | null {
  const candidates = addressCandidates(a).filter((_, i) => allowCounty || i < 6);
  const known = matchKnownQuartier(candidates);
  if (known) return known;
  for (const label of candidates) {
    if (isValidQuartierLabel(label)) return label.trim();
  }
  return null;
}

function pickFromDisplayName(displayName?: string): string | null {
  const parts =
    displayName?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const known = matchKnownQuartier(parts);
  if (known) return known;
  return (
    parts.find((p) => isValidQuartierLabel(p) && !/mauritanie/i.test(p)) ?? null
  );
}

/** Reverse geocoding : priorité quartier/arrondissement (zoom large), jamais un POI précis. */
export async function reverseLocation(
  lat: number,
  lng: number
): Promise<{ quartier: string | null; cityName: string | null }> {
  try {
    let cityName: string | null = null;

    for (const zoom of [10, 12, 14]) {
      const payload = await fetchReverse(lat, lng, zoom);
      if (!payload) continue;

      cityName = cityName ?? cityFromAddress(payload.address);
      const known = matchKnownQuartier([
        ...addressCandidates(payload.address),
        ...((payload.display_name ?? "").split(",").map((s) => s.trim()) ?? []),
      ]);
      if (known) return { quartier: known, cityName };

      const areaQuartier = extractAreaQuartier(payload.address, zoom <= 12);
      if (areaQuartier) return { quartier: areaQuartier, cityName };
    }

    const fallback = await fetchReverse(lat, lng, 10);
    const fromDisplay = pickFromDisplayName(fallback?.display_name);
    return {
      quartier: fromDisplay,
      cityName: cityName ?? cityFromAddress(fallback?.address),
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

/** Demande la permission une seule fois (sans lire la position). */
export async function ensureLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
    const requested = await Geolocation.requestPermissions();
    return requested.location === "granted";
  }
  return true;
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
  if (Capacitor.isNativePlatform()) {
    return getNativePosition();
  }
  return getBrowserPosition();
}

export function geolocationErrorReason(err: unknown): "denied" | "unavailable" {
  const code = (err as GeolocationPositionError)?.code;
  if (code === 1) return "denied";
  return "unavailable";
}
