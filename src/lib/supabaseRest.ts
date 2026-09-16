import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { currentAccessToken } from "./accessToken";
import { supabaseAnonKey, supabaseUrl } from "./supabase";

export type RestQuery = {
  select?: string;
  eq?: Record<string, string | number | boolean>;
  neq?: Record<string, string | number | boolean>;
  in?: Record<string, Array<string | number>>;
  gt?: Record<string, string | number>;
  gte?: Record<string, string | number>;
  lt?: Record<string, string | number>;
  lte?: Record<string, string | number>;
  is?: Record<string, "null" | "true" | "false">;
  order?: string;
  limit?: number;
  offset?: number;
};

function bearer(accessToken?: string | null): string {
  return accessToken || currentAccessToken() || supabaseAnonKey;
}

function headers(
  accessToken?: string | null,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${bearer(accessToken)}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extra,
  };
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? (data as T[]) : [];
}

export function restErrorMessage(status: number, data: unknown): string {
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
  if (lower.includes("row-level security") || status === 403) {
    return "Action non autorisée.";
  }
  return msg || `Erreur serveur (${status})`;
}

function addOp(
  params: URLSearchParams,
  op: string,
  rec?: Record<string, string | number | boolean>
): void {
  if (!rec) return;
  for (const [key, value] of Object.entries(rec)) {
    params.set(key, `${op}.${value}`);
  }
}

export function buildRestParams(query: RestQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.select) params.set("select", query.select);
  addOp(params, "eq", query.eq);
  addOp(params, "neq", query.neq);
  addOp(params, "gt", query.gt);
  addOp(params, "gte", query.gte);
  addOp(params, "lt", query.lt);
  addOp(params, "lte", query.lte);
  if (query.is) {
    for (const [key, value] of Object.entries(query.is)) {
      params.set(key, `is.${value}`);
    }
  }
  if (query.in) {
    for (const [key, values] of Object.entries(query.in)) {
      params.set(key, `in.(${values.join(",")})`);
    }
  }
  if (query.order) params.set("order", query.order);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  return params;
}

function emptyInFilter(query: RestQuery): boolean {
  if (!query.in) return false;
  return Object.values(query.in).some((values) => values.length === 0);
}

async function restRequest(opts: {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): Promise<{ status: number; data: unknown }> {
  const { method, url, headers: h, body } = opts;
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      method,
      url,
      headers: h,
      data: body,
      connectTimeout: 12_000,
      readTimeout: 12_000,
    });
    return { status: res.status, data: res.data };
  }
  const res = await fetch(url, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}

function tableUrl(table: string, params?: URLSearchParams): string {
  const qs = params?.toString();
  return qs
    ? `${supabaseUrl}/rest/v1/${table}?${qs}`
    : `${supabaseUrl}/rest/v1/${table}`;
}

/**
 * SELECT PostgREST avec JWT explicite (iOS : supabase.from() omet souvent le jeton).
 */
export async function restSelect<T = unknown>(
  table: string,
  query: RestQuery = {},
  accessToken?: string | null
): Promise<{ data: T[]; error?: string }> {
  if (emptyInFilter(query)) return { data: [] };
  try {
    const res = await restRequest({
      method: "GET",
      url: tableUrl(table, buildRestParams(query)),
      headers: headers(accessToken),
    });
    if (res.status < 200 || res.status >= 300) {
      return { data: [], error: restErrorMessage(res.status, res.data) };
    }
    return { data: asList<T>(res.data) };
  } catch (err) {
    console.warn("[rest] select", table, err);
    return { data: [], error: "Réseau indisponible." };
  }
}

export async function restSelectOne<T = unknown>(
  table: string,
  query: RestQuery,
  accessToken?: string | null
): Promise<{ data: T | null; error?: string }> {
  const { data, error } = await restSelect<T>(
    table,
    { ...query, limit: query.limit ?? 1 },
    accessToken
  );
  if (error) return { data: null, error };
  return { data: data[0] ?? null };
}

export async function restInsert<T = unknown>(
  table: string,
  payload: Record<string, unknown> | Record<string, unknown>[],
  accessToken?: string | null,
  opts?: { returning?: boolean; onConflict?: string }
): Promise<{ data?: T; error?: string }> {
  const token = accessToken || currentAccessToken();
  if (!token) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }
  const params = new URLSearchParams();
  if (opts?.onConflict) params.set("on_conflict", opts.onConflict);
  const prefer = [
    opts?.returning ? "return=representation" : "return=minimal",
    opts?.onConflict ? "resolution=merge-duplicates" : null,
  ]
    .filter(Boolean)
    .join(",");
  try {
    const res = await restRequest({
      method: "POST",
      url: tableUrl(table, params.toString() ? params : undefined),
      headers: headers(token, { Prefer: prefer }),
      body: payload,
    });
    if (res.status < 200 || res.status >= 300) {
      return { error: restErrorMessage(res.status, res.data) };
    }
    if (!opts?.returning) return {};
    const rows = asList<T>(res.data);
    const single = !Array.isArray(payload)
      ? rows[0] ?? (res.data as T)
      : (res.data as T);
    return { data: single };
  } catch (err) {
    console.warn("[rest] insert", table, err);
    return { error: "Réseau indisponible." };
  }
}

export async function restUpdate(
  table: string,
  query: RestQuery,
  patch: Record<string, unknown>,
  accessToken?: string | null
): Promise<{ error?: string }> {
  const token = accessToken || currentAccessToken();
  if (!token) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }
  if (emptyInFilter(query)) return {};
  try {
    const res = await restRequest({
      method: "PATCH",
      url: tableUrl(table, buildRestParams(query)),
      headers: headers(token, { Prefer: "return=minimal" }),
      body: patch,
    });
    if (res.status < 200 || res.status >= 300) {
      return { error: restErrorMessage(res.status, res.data) };
    }
    return {};
  } catch (err) {
    console.warn("[rest] update", table, err);
    return { error: "Réseau indisponible." };
  }
}

export async function restDelete(
  table: string,
  query: RestQuery,
  accessToken?: string | null
): Promise<{ error?: string }> {
  const token = accessToken || currentAccessToken();
  if (!token) {
    return { error: "Session expirée. Déconnectez-vous puis reconnectez-vous." };
  }
  if (emptyInFilter(query)) return {};
  try {
    const res = await restRequest({
      method: "DELETE",
      url: tableUrl(table, buildRestParams(query)),
      headers: headers(token, { Prefer: "return=minimal" }),
    });
    if (res.status < 200 || res.status >= 300) {
      return { error: restErrorMessage(res.status, res.data) };
    }
    return {};
  } catch (err) {
    console.warn("[rest] delete", table, err);
    return { error: "Réseau indisponible." };
  }
}
