import { mapAuthError } from "./authErrors";
import { invokeEdgeFunction } from "./supabaseRpc";

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
  const { data, error } = await invokeEdgeFunction("admin-book-passenger", {
    tripId: args.tripId,
    fullName: args.fullName,
    phone: args.phone,
    seats: args.seats,
    pickupQuartier: args.pickupQuartier || null,
  });
  if (error) {
    return { error: mapAuthError(error) };
  }
  const payload = (data ?? {}) as AdminBookPassengerResult;
  if (payload.error) return { error: mapAuthError(payload.error) };
  return payload;
}
