import { Capacitor, CapacitorHttp } from "@capacitor/core";
import type { User } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./supabase";
import type { Profile, UserRole } from "./types";

const PROFILE_SELECT = [
  "id",
  "role",
  "full_name",
  "phone",
  "preferred_lang",
  "driver_status",
  "rating_avg",
  "rating_count",
  "must_change_password",
  "current_trip_id",
  "license_number",
  "base_city_id",
  "photo_url",
  "gps_consent",
  "quartier",
  "city_label",
  "location_lat",
  "location_lng",
  "location_updated_at",
  "terms_accepted_version",
  "terms_accepted_at",
  "created_at",
  "updated_at",
].join(",");

/** Profil utilisable tout de suite (métadonnées auth) si le REST iOS est lent / bloqué. */
export function profileFromUser(u: User): Profile {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const roleMeta = meta.role;
  const role: UserRole =
    roleMeta === "driver" || roleMeta === "admin" ? roleMeta : "passenger";
  const now = new Date().toISOString();
  return {
    id: u.id,
    role,
    full_name: (meta.full_name as string) ?? (meta.nom as string) ?? null,
    phone: (meta.phone as string) ?? null,
    preferred_lang: "fr",
    driver_status: role === "driver" ? "pending" : null,
    rating_avg: null,
    rating_count: 0,
    must_change_password: false,
    current_trip_id: null,
    created_at: now,
    updated_at: now,
  };
}

function profileHeaders(accessToken: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

function firstProfile(data: unknown): Profile | null {
  if (Array.isArray(data)) {
    return (data[0] as Profile | undefined) ?? null;
  }
  if (data && typeof data === "object" && "id" in data) {
    return data as Profile;
  }
  return null;
}

function profilesUrl(userId: string): string {
  const params = new URLSearchParams({
    id: `eq.${userId}`,
    select: PROFILE_SELECT,
  });
  return `${supabaseUrl}/rest/v1/profiles?${params.toString()}`;
}

async function fetchViaCapacitorHttp(
  url: string,
  headers: Record<string, string>
): Promise<unknown> {
  const res = await CapacitorHttp.get({
    url,
    headers,
    connectTimeout: 6000,
    readTimeout: 6000,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`http_${res.status}`);
  }
  return res.data;
}

async function fetchViaWindow(url: string, headers: Record<string, string>): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Lecture profil avec le JWT de la session — sans supabase.from()
 * (évite le verrou auth + fetch WKWebView qui expire sur iOS).
 */
export async function fetchProfileWithAccessToken(
  userId: string,
  accessToken: string
): Promise<Profile | null> {
  const url = profilesUrl(userId);
  const headers = profileHeaders(accessToken);

  if (Capacitor.isNativePlatform()) {
    try {
      return firstProfile(await fetchViaCapacitorHttp(url, headers));
    } catch (err) {
      console.warn("[auth] profil natif:", err);
    }
  }

  try {
    return firstProfile(await fetchViaWindow(url, headers));
  } catch (err) {
    console.warn("[auth] profil fetch:", err);
    return null;
  }
}
