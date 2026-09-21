import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

export type TripInsertPayload = {
  driver_id: string;
  vehicle_id: string | null;
  from_city_id: string;
  to_city_id: string;
  depart_at: string;
  price_per_seat: number;
  seats_total: number;
  seats_available: number;
  notes: string | null;
  status: "scheduled";
  city_price_id: string | null;
  distance_km: number | null;
  depart_lat: number | null;
  depart_lng: number | null;
  depart_quartier: string | null;
};

function restErrorMessage(status: number, data: unknown): string {
  const obj =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const msg = String(obj?.message ?? obj?.error ?? "");
  if (status === 401 || /jwt|expired|not authenticated/i.test(msg)) {
    return "Session expirée. Déconnectez-vous puis reconnectez-vous.";
  }
  if (status === 403 || /row-level security/i.test(msg)) {
    return "Publication refusée. Reconnectez-vous avec le compte chauffeur, puis réessayez.";
  }
  if (/active trip/i.test(msg)) {
    return "Vous avez déjà un voyage en cours. Terminez-le avant d'en publier un autre.";
  }
  return msg || `Erreur serveur (${status})`;
}

async function insertViaNativeHttp(
  payload: TripInsertPayload,
  accessToken: string
): Promise<{ error?: string }> {
  const res = await CapacitorHttp.post({
    url: `${supabaseUrl}/rest/v1/trips`,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    data: payload,
    connectTimeout: 15_000,
    readTimeout: 15_000,
  });
  if (res.status >= 200 && res.status < 300) return {};
  return { error: restErrorMessage(res.status, res.data) };
}

async function insertViaFetch(
  payload: TripInsertPayload,
  accessToken: string
): Promise<{ error?: string }> {
  const res = await fetch(`${supabaseUrl}/rest/v1/trips`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return {};
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { error: restErrorMessage(res.status, data) };
}

/**
 * Publie un voyage avec le JWT de la session (pas supabase.from).
 * Sur iOS, le client JS peut perdre le jeton → RLS « trips ».
 */
export async function insertDriverTrip(
  payload: TripInsertPayload,
  accessToken: string,
  refreshToken?: string | null
): Promise<{ error?: string }> {
  if (!accessToken) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }

  if (refreshToken) {
    try {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch {
      /* on publie quand même avec le Bearer */
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      return await insertViaNativeHttp(payload, accessToken);
    } catch (err) {
      console.warn("[trip] insert natif:", err);
    }
  }

  try {
    return await insertViaFetch(payload, accessToken);
  } catch (err) {
    console.warn("[trip] insert fetch:", err);
  }

  const { error } = await supabase.from("trips").insert(payload);
  if (error) {
    return { error: restErrorMessage(403, { message: error.message }) };
  }
  return {};
}
