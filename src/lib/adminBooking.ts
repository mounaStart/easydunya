import { mapAuthError } from "./authErrors";
import { supabase } from "./supabase";

export type AdminBookPassengerResult = {
  accountCreated?: boolean;
  password?: string | null;
  passengerId?: string;
  bookingId?: string;
  confirmationCode?: string;
  status?: string;
  seats?: number;
  error?: string;
};

export async function adminBookPassenger(args: {
  tripId: string;
  fullName: string;
  phone: string;
  seats: number;
  pickupQuartier?: string;
}): Promise<AdminBookPassengerResult> {
  const { data, error } = await supabase.functions.invoke("admin-book-passenger", {
    body: {
      tripId: args.tripId,
      fullName: args.fullName,
      phone: args.phone,
      seats: args.seats,
      pickupQuartier: args.pickupQuartier || null,
    },
  });
  if (error) {
    const raw = error.message.toLowerCase();
    const missing =
      raw.includes("edge function") ||
      raw.includes("not found") ||
      raw.includes("404") ||
      raw.includes("failed to send") ||
      raw.includes("admin-book-passenger");
    if (missing) {
      return {
        error: mapAuthError("functions/v1/admin-book-passenger"),
      };
    }
    return { error: mapAuthError(error.message) };
  }
  const payload = (data ?? {}) as AdminBookPassengerResult;
  if (payload.error) return { error: mapAuthError(payload.error) };
  return payload;
}
