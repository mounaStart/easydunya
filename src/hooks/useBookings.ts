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
    })
    .select()
    .single();
  if (error) return { error: error.message };
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
  return { error: error?.message };
}
