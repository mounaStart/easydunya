import { suggestFare } from "./types";
import type { AgencyStop, AgencyTrip } from "./types";

export function tripStops(trip: AgencyTrip): AgencyStop[] {
  if (trip.stops && trip.stops.length >= 2) {
    return [...trip.stops].sort((a, b) => a.index - b.index);
  }
  const t0 = trip.departAt.slice(11, 16);
  return [
    { index: 0, cityId: trip.fromCityId, city: trip.fromName, time: t0 },
    { index: 1, cityId: trip.toCityId, city: trip.toName, time: null },
  ];
}

export function lastStopIndex(trip: AgencyTrip): number {
  const s = tripStops(trip);
  return s[s.length - 1]?.index ?? 1;
}

export function isMultiStop(trip: AgencyTrip): boolean {
  return tripStops(trip).length >= 3;
}

export function fareKey(fromIdx: number, toIdx: number): string {
  return `${fromIdx}-${toIdx}`;
}

export function farePrice(trip: AgencyTrip, fromIdx: number, toIdx: number): number {
  if (fromIdx >= toIdx) return trip.price;
  const key = fareKey(fromIdx, toIdx);
  if (trip.fares && trip.fares[key] != null) return trip.fares[key];
  if (!isMultiStop(trip) && fromIdx === 0 && toIdx === lastStopIndex(trip)) return trip.price;
  const stops = tripStops(trip);
  const a = stops.find((s) => s.index === fromIdx)?.city ?? trip.fromName;
  const b = stops.find((s) => s.index === toIdx)?.city ?? trip.toName;
  return suggestFare(a, b) || trip.price;
}

export function displayFromPrice(trip: AgencyTrip): number {
  const stops = tripStops(trip);
  if (stops.length < 3) return trip.price;
  let min = trip.price;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      min = Math.min(min, farePrice(trip, stops[i].index, stops[j].index));
    }
  }
  return min;
}

export function stopLabel(trip: AgencyTrip, idx: number): string {
  return tripStops(trip).find((s) => s.index === idx)?.city ?? `Arrêt ${idx}`;
}

export function legLabel(trip: AgencyTrip, fromIdx: number, toIdx: number): string {
  return `${stopLabel(trip, fromIdx)} → ${stopLabel(trip, toIdx)}`;
}

export function buildFares(stops: AgencyStop[]): Record<string, number> {
  const fares: Record<string, number> = {};
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      fares[fareKey(stops[i].index, stops[j].index)] = suggestFare(stops[i].city, stops[j].city);
    }
  }
  return fares;
}

export function addHoursToTime(hhmm: string, hours: number): { time: string; extraDays: number } {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const extraDays = Math.floor(total / (24 * 60));
  const rem = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(rem / 60)).padStart(2, "0");
  const mm = String(rem % 60).padStart(2, "0");
  return { time: `${hh}:${mm}`, extraDays };
}
