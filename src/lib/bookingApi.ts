import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
import type { Booking } from "./types";

function asList(data: unknown): Booking[] {
  return Array.isArray(data) ? (data as Booking[]) : [];
}

function headers(accessToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function bookingsUrl(params: URLSearchParams): string {
  return `${supabaseUrl}/rest/v1/bookings?${params.toString()}`;
}

async function restGet(url: string, accessToken: string): Promise<unknown> {
  const h = headers(accessToken);
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.get({
      url,
      headers: h,
      connectTimeout: 12_000,
      readTimeout: 12_000,
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`http_${res.status}`);
    }
    return res.data;
  }
  const res = await fetch(url, { headers: h });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return res.json();
}

async function restPatch(
  url: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ error?: string }> {
  const h = { ...headers(accessToken, true), Prefer: "return=minimal" };
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.patch({
      url,
      headers: h,
      data: body,
      connectTimeout: 12_000,
      readTimeout: 12_000,
    });
    if (res.status < 200 || res.status >= 300) {
      return { error: `http_${res.status}` };
    }
    return {};
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: `http_${res.status}` };
  return {};
}

export type BookingQuery = {
  tripId?: string;
  tripIds?: string[];
  passengerId?: string;
  status?: string | string[];
  isWaiting?: boolean;
  select?: string;
  order?: string;
};

function buildParams(q: BookingQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("select", q.select ?? "*");
  if (q.tripId) params.set("trip_id", `eq.${q.tripId}`);
  if (q.tripIds && q.tripIds.length > 0) {
    params.set("trip_id", `in.(${q.tripIds.join(",")})`);
  }
  if (q.passengerId) params.set("passenger_id", `eq.${q.passengerId}`);
  if (typeof q.status === "string") params.set("status", `eq.${q.status}`);
  if (Array.isArray(q.status) && q.status.length > 0) {
    params.set("status", `in.(${q.status.join(",")})`);
  }
  if (typeof q.isWaiting === "boolean") {
    params.set("is_waiting", `eq.${q.isWaiting}`);
  }
  params.set("order", q.order ?? "created_at.desc");
  return params;
}

/**
 * Lecture des réservations avec le JWT (iOS : supabase.from() omet souvent le jeton → RLS vide).
 */
export async function fetchBookingsWithAccessToken(
  accessToken: string | undefined,
  query: BookingQuery
): Promise<Booking[]> {
  if (query.tripIds && query.tripIds.length === 0) return [];

  if (accessToken) {
    try {
      return asList(await restGet(bookingsUrl(buildParams(query)), accessToken));
    } catch (err) {
      console.warn("[booking] rest:", err);
    }
  }

  let req = supabase.from("bookings").select(query.select ?? "*");
  if (query.tripId) req = req.eq("trip_id", query.tripId);
  if (query.tripIds && query.tripIds.length > 0) req = req.in("trip_id", query.tripIds);
  if (query.passengerId) req = req.eq("passenger_id", query.passengerId);
  if (typeof query.status === "string") req = req.eq("status", query.status);
  if (Array.isArray(query.status) && query.status.length > 0) {
    req = req.in("status", query.status);
  }
  if (typeof query.isWaiting === "boolean") req = req.eq("is_waiting", query.isWaiting);
  req = req.order("created_at", { ascending: false });
  const { data } = await req;
  return asList(data);
}

export async function patchBookingWithAccessToken(
  bookingId: string,
  patch: Record<string, unknown>,
  accessToken: string | undefined
): Promise<{ error?: string }> {
  if (accessToken) {
    const params = new URLSearchParams({ id: `eq.${bookingId}` });
    const restErr = await restPatch(bookingsUrl(params), accessToken, patch);
    if (!restErr.error) return {};
    console.warn("[booking] patch rest:", restErr.error);
  }
  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
  return { error: error?.message };
}
