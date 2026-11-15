import { useEffect, useMemo, useState } from "react";
import {
  currentAgency,
  currentStaff,
  getAgencyDb,
  getAgencySession,
  hydrateAgencyCloud,
  subscribeAgency,
} from "./store";
import { hasPerm } from "./rules";
import type { AgencyPerm } from "./types";

export function useAgency() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    void hydrateAgencyCloud();
  }, []);
  const session = getAgencySession();
  const staff = currentStaff();
  const agency = currentAgency();
  const db = getAgencyDb();
  const can = (p: AgencyPerm) => !!staff && hasPerm(staff, p);
  const scoped = useMemo(() => {
    if (!staff) {
      return { trips: [], bookings: [], vehicles: [], drivers: [], points: [], staffAll: [] };
    }
    const trips = db.trips.filter((t) => t.agencyId === staff.agencyId);
    const bookings = db.bookings.filter((b) => b.agencyId === staff.agencyId);
    return {
      trips,
      bookings,
      vehicles: db.vehicles.filter((v) => v.agencyId === staff.agencyId),
      drivers: db.drivers.filter((d) => d.agencyId === staff.agencyId),
      points: db.points.filter((p) => p.agencyId === staff.agencyId),
      staffAll: db.staff.filter((x) => x.agencyId === staff.agencyId),
    };
  }, [db, staff]);
  return { session, staff, agency, db, can, ...scoped };
}
