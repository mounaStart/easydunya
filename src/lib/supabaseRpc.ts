import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { currentAccessToken } from "./accessToken";
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";

export function mapRpcError(status: number, data: unknown): string {
  const obj =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  const msg = String(obj?.message ?? obj?.error ?? data ?? "");
  const lower = msg.toLowerCase();
  if (
    status === 401 ||
    lower.includes("not authenticated") ||
    lower.includes("jwt") ||
    lower.includes("expired")
  ) {
    return "Session expirée. Déconnectez-vous puis reconnectez-vous.";
  }
  if (lower.includes("trip not found")) return "Voyage introuvable.";
  if (lower.includes("trip not scheduled")) return "Ce voyage n'est plus programmé.";
  if (lower.includes("already engaged") || lower.includes("active trip")) {
    return "Vous avez déjà un voyage en cours.";
  }
  if (lower.includes("forbidden") || status === 403) {
    return "Action non autorisée.";
  }
  return msg || `Erreur serveur (${status})`;
}

function rpcHeaders(accessToken: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * RPC PostgREST avec JWT explicite (iOS : supabase.rpc omet le jeton → « not authenticated »).
 */
export async function invokeRpcWithAccessToken(
  fn: string,
  params: Record<string, unknown>,
  accessToken = currentAccessToken()
): Promise<{ data?: unknown; error?: string }> {
  if (!accessToken) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }

  const url = `${supabaseUrl}/rest/v1/rpc/${fn}`;
  const headers = rpcHeaders(accessToken);

  try {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.post({
        url,
        headers,
        data: params,
        connectTimeout: 15_000,
        readTimeout: 15_000,
      });
      if (res.status < 200 || res.status >= 300) {
        return { error: mapRpcError(res.status, res.data) };
      }
      return { data: res.data };
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { error: mapRpcError(res.status, data) };
    }
    const text = await res.text();
    if (!text) return {};
    try {
      return { data: JSON.parse(text) };
    } catch {
      return { data: text };
    }
  } catch (err) {
    console.warn("[rpc]", fn, err);
  }

  const { data, error } = await supabase.rpc(fn, params);
  if (error) return { error: mapRpcError(401, { message: error.message }) };
  return { data };
}

export async function patchRowWithAccessToken(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  accessToken = currentAccessToken()
): Promise<{ error?: string }> {
  if (!accessToken) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }
  const url = `${supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`;
  const headers = {
    ...rpcHeaders(accessToken),
    Prefer: "return=minimal",
  };

  try {
    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.patch({
        url,
        headers,
        data: patch,
        connectTimeout: 12_000,
        readTimeout: 12_000,
      });
      if (res.status < 200 || res.status >= 300) {
        return { error: mapRpcError(res.status, res.data) };
      }
      return {};
    }
    const res = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      return { error: mapRpcError(res.status, data) };
    }
    return {};
  } catch (err) {
    console.warn("[patch]", table, err);
  }

  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return { error: mapRpcError(401, { message: error.message }) };
  return {};
}
