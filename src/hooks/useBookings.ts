import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { generateConfirmationCode } from "../lib/codes";
import { currentAccessToken } from "../lib/accessToken";
import {
  fetchBookingsWithAccessToken,
  insertBookingWithAccessToken,
  patchBookingWithAccessToken,
} from "../lib/bookingApi";
import { invokeRpcWithAccessToken } from "../lib/supabaseRpc";
import { restSelectOne, restUpdate } from "../lib/supabaseRest";
import { useAuth } from "./useAuth";
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
  const result = await insertBookingWithAccessToken({
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
  });
  if (result.error) return { error: result.error };

  // Le chauffeur est notifié côté base (trigger trg_booking_notify_driver),
  // ce qui fonctionne aussi pour les passagers invités et déclenche le push.

  return { booking: result.booking };
}

export async function findBookingByCode(code: string): Promise<Booking | null> {
  if (!code) return null;
  const token = currentAccessToken();
  const { data, error } = await invokeRpcWithAccessToken(
    "get_booking_by_code",
    { p_code: code },
    token,
    { allowAnon: true }
  );
  if (!error) {
    const rows = Array.isArray(data) ? (data as Booking[]) : [];
    if (rows[0]) return rows[0];
  }
  const { data: row } = await restSelectOne<Booking>(
    "bookings",
    {
      select: "*",
      eq: { confirmation_code: code.toUpperCase() },
    },
    token
  );
  return row;
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
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!passengerId) return;
    setLoading(true);
    const data = await fetchBookingsWithAccessToken(accessToken, {
      passengerId,
    });
    setBookings(data);
    setLoading(false);
  }, [passengerId, accessToken]);

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
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    const data = await fetchBookingsWithAccessToken(accessToken, { tripId });
    setBookings(data);
    setLoading(false);
  }, [tripId, accessToken]);

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
  status: Booking["status"],
  accessToken?: string
) {
  const { error } = await patchBookingWithAccessToken(
    bookingId,
    { status },
    accessToken
  );

  // Notifications passager : trigger SQL trg_booking_notify_status (migration 0020)

  return { error };
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
  const token = currentAccessToken();
  const { data: before } = await restSelectOne<{
    trip_id: string;
    seats: number;
    confirmation_code: string;
    status: string;
  }>(
    "bookings",
    {
      select: "trip_id,seats,confirmation_code,status",
      eq: { id: bookingId },
    },
    token
  );

  if (before && (before.status === "cancelled" || before.status === "completed")) {
    return { error: "already_closed" };
  }

  const trimmedReason = reason?.trim() || null;

  const { error: rpcError } = await invokeRpcWithAccessToken(
    "passenger_cancel_booking",
    { p_booking_id: bookingId, p_reason: trimmedReason },
    token
  );

  if (rpcError) {
    const msg = rpcError;
    const fnMissing =
      /passenger_cancel_booking/i.test(msg) ||
      /Could not find the function/i.test(msg);

    if (!fnMissing) {
      if (/already_closed/i.test(msg)) return { error: "already_closed" };
      if (/reason_required/i.test(msg)) return { error: "reason_required" };
      if (/not_allowed/i.test(msg)) return { error: "not_allowed" };
      if (/trip_already_started/i.test(msg)) return { error: "trip_started" };
      return { error: msg };
    }

    const payload: Record<string, unknown> = { status: "cancelled" };
    if (trimmedReason) payload.cancel_reason = trimmedReason;

    let upd = await restUpdate(
      "bookings",
      { eq: { id: bookingId } },
      payload,
      token
    );

    if (upd.error && /cancel_reason/i.test(upd.error)) {
      upd = await restUpdate(
        "bookings",
        { eq: { id: bookingId } },
        { status: "cancelled" },
        token
      );
    }

    if (upd.error) return { error: upd.error };
  }

  return {};
}

export async function cancelTripWithBroadcast(
  tripId: string,
  reason?: string,
  accessToken?: string
) {
  const { data, error } = await invokeRpcWithAccessToken(
    "cancel_trip_with_broadcast",
    { p_trip_id: tripId, p_reason: reason ?? null },
    accessToken
  );
  if (error) return { error };
  return { notified: data as number };
}
