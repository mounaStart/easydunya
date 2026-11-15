import { buildDemoDb } from "../src/lib/agency/demo";
import { firstFreeSeats, freeSeatCount, occupiedOnLegs, occupancyBySegment } from "../src/lib/agency/rules";
import { farePrice, tripStops } from "../src/lib/agency/trip";
import type { AgencyTrip } from "../src/lib/agency/types";

const db = buildDemoDb();
const trip = db.trips.find((t) => t.id === "agtr-sahel-nema");
if (!trip) throw new Error("Trajet SAHEL Néma introuvable");

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function matches(t: AgencyTrip, fromId?: string, toId?: string) {
  const ids = tripStops(t).map((s) => s.cityId);
  const fi = fromId ? ids.indexOf(fromId) : 0;
  const ti = toId ? ids.lastIndexOf(toId) : ids.length - 1;
  return fi >= 0 && ti >= 0 && fi < ti;
}

const NKC = "11111111-1111-1111-1111-000000000001";
const ALEG = "11111111-1111-1111-1111-000000000006";
const KIFFA = "11111111-1111-1111-1111-000000000007";
const NEMA = "11111111-1111-1111-1111-000000000009";

assert(farePrice(trip, 0, 1) === 450, "tarif NKC-Aleg");
assert(farePrice(trip, 0, 2) === 1000, "tarif NKC-Kiffa");
assert(farePrice(trip, 0, 3) === 1700, "tarif NKC-Néma");
assert(farePrice(trip, 1, 3) === 1250, "tarif Aleg-Néma");

const on01 = occupiedOnLegs(db, trip.id, 0, 1);
assert(on01.has(3) && on01.has(4) && on01.has(7), "Mariem 3,4 + Awa 7 sur NKC-Aleg");
assert(!on01.has(5), "place 5 libre NKC-Aleg");

const on13 = occupiedOnLegs(db, trip.id, 1, 3);
assert(on13.has(3), "Sidi place 3 Aleg→Néma");
assert(on13.has(7), "Awa place 7 jusqu'à Kiffa (tronçon 1-2)");
assert(!on13.has(4), "place 4 libérée après Aleg");

const on23 = occupiedOnLegs(db, trip.id, 2, 3);
assert(on23.has(3) && !on23.has(7) && !on23.has(4), "Kiffa→Néma : seul Sidi (3)");

assert(freeSeatCount(db, trip) === 12, `places affichées = min tronçon, got ${freeSeatCount(db, trip)}`);

const segs = occupancyBySegment(db, trip);
assert(segs[0].occupied === 3 && segs[0].from === "Nouakchott", "tronçon 0 occupé 3");
assert(segs[2].occupied === 1 && segs[2].from === "Kiffa", "tronçon 2 occupé 1");

const refuseFull = firstFreeSeats(db, trip, 1, 0, 3);
assert(!refuseFull.includes(3), "place 3 refusée NKC-Néma");

assert(matches(trip, ALEG, KIFFA), "recherche Aleg-Kiffa");
assert(matches(trip, NKC, NEMA), "recherche NKC-Néma");
assert(!matches(trip, NEMA, NKC), "sens inverse refusé");

console.log("ok petites agences", {
  free: freeSeatCount(db, trip),
  segs: segs.map((s) => `${s.from}→${s.to}:${s.occupied}`),
});
