import {
  getCurrentPosition,
  geolocationErrorReason,
  isStreetLikeName,
  reverseLocation,
} from "./geocode";
import { supabase } from "./supabase";
import type { Booking, Profile } from "./types";

export interface PassengerLocation {
  lat: number;
  lng: number;
  quartier: string | null;
  cityLabel: string | null;
}

const SYNC_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function resolveQuartierLabel(
  quartier: string | null | undefined,
  cityName: string | null | undefined,
  fallback?: string | null
): string | null {
  const q = quartier?.trim();
  if (q) return q;
  const city = cityName?.trim() || fallback?.trim();
  return city || null;
}

/** Capture GPS + reverse geocoding (quartier + ville). */
export async function capturePassengerLocation(): Promise<PassengerLocation | null> {
  try {
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const { quartier, cityName } = await reverseLocation(lat, lng);
    return {
      lat,
      lng,
      quartier: resolveQuartierLabel(quartier, cityName),
      cityLabel: cityName,
    };
  } catch {
    return null;
  }
}

export function locationFromProfile(profile: Profile | null): PassengerLocation | null {
  if (
    !profile ||
    profile.location_lat == null ||
    profile.location_lng == null ||
    !Number.isFinite(profile.location_lat) ||
    !Number.isFinite(profile.location_lng)
  ) {
    return null;
  }
  return {
    lat: profile.location_lat,
    lng: profile.location_lng,
    quartier: profile.quartier ?? null,
    cityLabel: profile.city_label ?? null,
  };
}

/** Enregistre la position du passager sur son profil. */
export async function savePassengerLocation(
  userId: string,
  loc: PassengerLocation
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("profiles")
    .update({
      quartier: loc.quartier,
      city_label: loc.cityLabel,
      location_lat: loc.lat,
      location_lng: loc.lng,
      location_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  return error ? { error: error.message } : {};
}

/** Complète le quartier à partir des coordonnées déjà enregistrées (sans redemander le GPS). */
export async function backfillQuartierFromProfile(
  userId: string,
  profile: Profile
): Promise<PassengerLocation | null> {
  if (
    profile.location_lat == null ||
    profile.location_lng == null ||
    !Number.isFinite(profile.location_lat) ||
    !Number.isFinite(profile.location_lng)
  ) {
    return null;
  }

  const { quartier, cityName } = await reverseLocation(
    profile.location_lat,
    profile.location_lng
  );
  const resolved = resolveQuartierLabel(quartier, cityName, profile.city_label);
  if (!resolved) return locationFromProfile(profile);

  if (profile.quartier?.trim() === resolved && !isStreetLikeName(resolved)) {
    return locationFromProfile(profile);
  }

  const loc: PassengerLocation = {
    lat: profile.location_lat,
    lng: profile.location_lng,
    quartier: resolved,
    cityLabel: profile.city_label ?? cityName,
  };
  await savePassengerLocation(userId, loc);
  return loc;
}

function needsLocationRefresh(profile: Profile | null): boolean {
  if (!profile || profile.role !== "passenger") return false;
  if (profile.location_lat == null || profile.location_lng == null) return true;
  if (!profile.quartier?.trim() || isStreetLikeName(profile.quartier)) return true;
  if (!profile.location_updated_at) return true;
  return Date.now() - new Date(profile.location_updated_at).getTime() > SYNC_MAX_AGE_MS;
}

/**
 * Met à jour le profil passager via GPS (inscription, connexion, ou rafraîchissement).
 * Ne bloque pas si l'utilisateur refuse la géolocalisation.
 */
export async function syncPassengerLocation(
  userId: string,
  profile: Profile | null,
  options?: { force?: boolean }
): Promise<PassengerLocation | null> {
  if (profile?.role !== "passenger") return null;

  // Recalcule le quartier depuis les coordonnées déjà enregistrées (ex. Arafat)
  if (profile.location_lat != null && profile.location_lng != null) {
    const backfilled = await backfillQuartierFromProfile(userId, profile);
    if (!options?.force && !needsLocationRefresh(profile)) {
      return backfilled ?? locationFromProfile(profile);
    }
  }

  if (!options?.force && !needsLocationRefresh(profile)) {
    return locationFromProfile(profile);
  }

  const captured = await capturePassengerLocation();
  if (!captured) return locationFromProfile(profile);

  await savePassengerLocation(userId, captured);
  return captured;
}

export function hasValidBookingLocation(profile: Profile | null): boolean {
  const loc = locationFromProfile(profile);
  return Boolean(loc?.quartier?.trim() && !isStreetLikeName(loc.quartier));
}

/** Repli sur le profil si le GPS frais échoue mais qu'une position valide existe déjà. */
async function bookingLocationFromProfile(
  userId: string,
  profile: Profile | null
): Promise<PassengerLocation | null> {
  if (!profile) return null;

  if (profile.location_lat != null && profile.location_lng != null) {
    const backfilled = await backfillQuartierFromProfile(userId, profile);
    if (backfilled?.quartier && !isStreetLikeName(backfilled.quartier)) {
      return backfilled;
    }
  }

  const loc = locationFromProfile(profile);
  if (loc?.quartier && !isStreetLikeName(loc.quartier)) return loc;
  return null;
}

/** GPS obligatoire avant réservation — refuse si pas de position ou quartier. */
export async function requireBookingLocation(
  userId: string,
  profile: Profile | null
): Promise<
  | { ok: true; location: PassengerLocation }
  | { ok: false; reason: "denied" | "unavailable" | "no_quartier" }
> {
  try {
    const pos = await getCurrentPosition();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const { quartier, cityName } = await reverseLocation(lat, lng);
    const resolved = resolveQuartierLabel(quartier, cityName, profile?.city_label);
    if (!resolved || isStreetLikeName(resolved)) {
      const fallback = await bookingLocationFromProfile(userId, profile);
      if (fallback) return { ok: true, location: fallback };
      return { ok: false, reason: "no_quartier" };
    }
    const loc: PassengerLocation = {
      lat,
      lng,
      quartier: resolved,
      cityLabel: cityName,
    };
    await savePassengerLocation(userId, loc);
    return { ok: true, location: loc };
  } catch (err) {
    const fallback = await bookingLocationFromProfile(userId, profile);
    if (fallback) return { ok: true, location: fallback };
    return { ok: false, reason: geolocationErrorReason(err) };
  }
}

/** Pickup pour une réservation (réutilise une position déjà validée si fournie). */
export async function resolveBookingPickup(
  userId: string | undefined,
  profile: Profile | null,
  cached?: PassengerLocation | null
): Promise<{
  pickupLat?: number;
  pickupLng?: number;
  pickupQuartier?: string;
  error?: "denied" | "unavailable" | "no_quartier";
}> {
  if (!userId) return { error: "unavailable" };

  if (
    cached?.lat != null &&
    cached.lng != null &&
    cached.quartier?.trim() &&
    !isStreetLikeName(cached.quartier)
  ) {
    return {
      pickupLat: cached.lat,
      pickupLng: cached.lng,
      pickupQuartier: cached.quartier,
    };
  }

  const result = await requireBookingLocation(userId, profile);
  if (!result.ok) return { error: result.reason };

  return {
    pickupLat: result.location.lat,
    pickupLng: result.location.lng,
    pickupQuartier: result.location.quartier ?? result.location.cityLabel ?? undefined,
  };
}

function pickDisplayQuartier(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    const label = c?.trim();
    if (label && !isStreetLikeName(label)) return label;
  }
  return null;
}

/** Coordonnées + quartier effectifs d'une réservation (repli sur le profil passager). */
export function enrichBookingPickup(
  booking: Booking,
  profile?: Profile | null
): Pick<Booking, "pickup_lat" | "pickup_lng" | "pickup_quartier"> {
  const lat = booking.pickup_lat ?? profile?.location_lat ?? null;
  const lng = booking.pickup_lng ?? profile?.location_lng ?? null;
  const quartier =
    pickDisplayQuartier(booking.pickup_quartier, profile?.quartier, profile?.city_label) ?? null;
  return {
    pickup_lat: lat,
    pickup_lng: lng,
    pickup_quartier: quartier,
  };
}
