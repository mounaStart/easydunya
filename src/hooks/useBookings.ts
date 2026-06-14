import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateConfirmationCode } from "../lib/codes";
import type { Booking } from "../lib/types";

export interface CreateBookingArgs {
  tripId: string;
  seats: number;
  passengerId?: string | null;
  guestName?: string;
  guestPhone?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupQuartier?: string;
  isWaiting?: boolean;
}

export async function createBooking(args: CreateBookingArgs): Promise<{
  booking?: Booking;
  error?: string;
}> {
  const code = generateConfirmationCode();
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      trip_id: args.tripId,
      seats: args.seats,
      passenger_id: args.passengerId ?? null,
      guest_name: args.guestName ?? null,
      guest_phone: args.guestPhone ?? null,
      confirmation_code: code,
      status: "pending",
      pickup_lat: args.pickupLat ?? null,
      pickup_lng: args.pickupLng ?? null,
      pickup_quartier: args.pickupQuartier ?? null,
      is_waiting: args.isWaiting ?? false,
    })
    .select()
    .single();
  if (error) return { error: error.message };

  // Le chauffeur est notifié côté base (trigger trg_booking_notify_driver),
  // ce qui fonctionne aussi pour les passagers invités et déclenche le push.

  return { booking: data as Booking };
}

export async function findBookingByCode(code: string): Promise<Booking | null> {
  if (!code) return null;
  // Fonction SECURITY DEFINER : lecture par code (clé d'accès), même invité.
  const { data, error } = await supabase.rpc("get_booking_by_code", {
    p_code: code,
  });
  if (error) {
    // Repli : lecture directe (fonctionne si c'est sa propre réservation)
    const { data: row } = await supabase
      .from("bookings")
      .select("*")
      .eq("confirmation_code", code.toUpperCase())
      .maybeSingle();
    return (row as Booking | null) ?? null;
  }
  const rows = (data as Booking[] | null) ?? [];
  return rows[0] ?? null;
}

const CODES_KEY = "ed_booking_codes";

/** Mémorise le code d'une réservation faite sur cet appareil. */
export function rememberBookingCode(code: string) {
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(CODES_KEY) ?? "[]");
    const next = [code, ...prev.filter((c) => c !== code)].slice(0, 20);
    localStorage.setItem(CODES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRememberedCodes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CODES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useMyBookings(passengerId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!passengerId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("passenger_id", passengerId)
      .order("created_at", { ascending: false });
    setBookings((data as Booking[] | null) ?? []);
    setLoading(false);
  }, [passengerId]);

  useEffect(() => {
    fetch();
    if (!passengerId) return;
    const channel = supabase
      .channel(`bookings-${passengerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `passenger_id=eq.${passengerId}`,
        },
        () => fetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [passengerId, fetch]);

  return { bookings, loading, refresh: fetch };
}

export function useTripBookings(tripId: string | undefined) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    setBookings((data as Booking[] | null) ?? []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetch();
    if (!tripId) return;
    const channel = supabase
      .channel(`trip-bookings-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `trip_id=eq.${tripId}`,
        },
        () => fetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, fetch]);

  return { bookings, loading, refresh: fetch };
}

export async function updateBookingStatus(
  bookingId: string,
  status: Booking["status"]
) {
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  // Notifications passager : trigger SQL trg_booking_notify_status (migration 0020)

  return { error: error?.message };
}

/**
 * Annulation d'une réservation PAR LE PASSAGER.
 * Le trigger SQL restitue automatiquement les places si elle était confirmée.
 * Le chauffeur est notifié. Un motif est requis si la réservation était
 * déjà confirmée par le chauffeur.
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ error?: string }> {
  const { data: before } = await supabase
    .from("bookings")
    .select("trip_id, seats, confirmation_code, status")
    .eq("id", bookingId)
    .maybeSingle();

  const row = before as
    | { trip_id: string; seats: number; confirmation_code: string; status: string }
    | null;

  if (row && (row.status === "cancelled" || row.status === "completed")) {
    return { error: "already_closed" };
  }

  const trimmedReason = reason?.trim() || null;

  // 1) RPC serveur (migration 0016) — le plus fiable
  const { error: rpcError } = await supabase.rpc("passenger_cancel_booking", {
    p_booking_id: bookingId,
    p_reason: trimmedReason,
  });

  if (rpcError) {
    const msg = rpcError.message ?? "";
    const fnMissing =
      /passenger_cancel_booking/i.test(msg) ||
      /Could not find the function/i.test(msg);

    if (!fnMissing) {
      // Erreurs métier explicites
      if (/already_closed/i.test(msg)) return { error: "already_closed" };
      if (/reason_required/i.test(msg)) return { error: "reason_required" };
      if (/not_allowed/i.test(msg)) return { error: "not_allowed" };
      if (/trip_already_started/i.test(msg)) return { error: "trip_started" };
      return { error: msg };
    }

    // 2) Repli : mise à jour directe (avant migration 0016)
    const payload: Record<string, unknown> = { status: "cancelled" };
    if (trimmedReason) payload.cancel_reason = trimmedReason;

    let { error: updError } = await supabase
      .from("bookings")
      .update(payload)
      .eq("id", bookingId);

    // Colonne cancel_reason absente → annuler sans motif en base
    if (updError && /cancel_reason/i.test(updError.message)) {
      const retry = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId);
      updError = retry.error;
    }

    if (updError) return { error: updError.message };
  }

  // Notification chauffeur : trigger SQL trg_booking_notify_status (migration 0020)

  return {};
}

export async function cancelTripWithBroadcast(tripId: string, reason?: string) {
  const { data, error } = await supabase.rpc("cancel_trip_with_broadcast", {
    p_trip_id: tripId,
    p_reason: reason ?? null,
  });
  if (error) return { error: error.message };
  return { notified: data as number };
}
