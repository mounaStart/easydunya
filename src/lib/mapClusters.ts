import type { Booking } from "./types";

export interface QuartierMarker {
  id: string;
  quartier: string;
  lat: number;
  lng: number;
  count: number;
  bookingIds: string[];
  passengerNames: string[];
}

/** Regroupe les réservations par quartier (moyenne GPS + effectif). */
export function clusterBookingsByQuartier(
  bookings: Booking[],
  getName: (b: Booking) => string
): QuartierMarker[] {
  const clusters = new Map<
    string,
    {
      quartier: string;
      latSum: number;
      lngSum: number;
      n: number;
      bookingIds: string[];
      passengerNames: string[];
    }
  >();

  for (const b of bookings) {
    const quartier = b.pickup_quartier?.trim();
    if (!quartier || b.pickup_lat == null || b.pickup_lng == null) continue;

    const key = quartier.toLowerCase();
    const lat = b.pickup_lat as number;
    const lng = b.pickup_lng as number;
    const name = getName(b);
    const bucket = clusters.get(key);

    if (bucket) {
      bucket.latSum += lat;
      bucket.lngSum += lng;
      bucket.n += 1;
      bucket.bookingIds.push(b.id);
      bucket.passengerNames.push(name);
    } else {
      clusters.set(key, {
        quartier,
        latSum: lat,
        lngSum: lng,
        n: 1,
        bookingIds: [b.id],
        passengerNames: [name],
      });
    }
  }

  return Array.from(clusters.entries()).map(([key, c]) => ({
    id: key,
    quartier: c.quartier,
    lat: c.latSum / c.n,
    lng: c.lngSum / c.n,
    count: c.n,
    bookingIds: c.bookingIds,
    passengerNames: c.passengerNames,
  }));
}
