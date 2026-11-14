import { generateAgencyBookingCode } from "./codes";
import { buildDemoDb } from "./demo";
import {
  firstFreeSeats,
  freeSeatCount,
  hasPerm,
  occupiedSeatNos,
  refundForCancel,
  sameDay,
} from "./rules";
import type {
  Agency,
  AgencyBooking,
  AgencyChannel,
  AgencyDB,
  AgencyDriver,
  AgencyPayMethod,
  AgencyPayStatus,
  AgencyPerm,
  AgencyPoint,
  AgencyStaff,
  AgencyStaffRole,
  AgencyTrip,
  AgencyVehicle,
} from "./types";

const KEY = "ed_agency_v1";
const SESSION_KEY = "ed_agency_session";

type Listener = () => void;
const listeners = new Set<Listener>();

function uid(): string {
  return crypto.randomUUID();
}

function load(): AgencyDB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AgencyDB;
  } catch {
    /* ignore */
  }
  const demo = buildDemoDb();
  save(demo);
  return demo;
}

function save(db: AgencyDB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

let db: AgencyDB = typeof window === "undefined" ? buildDemoDb() : load();

function commit(next: AgencyDB) {
  db = next;
  save(db);
  listeners.forEach((l) => l());
}

export function subscribeAgency(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAgencyDb(): AgencyDB {
  return db;
}

export function resetAgencyDemo() {
  commit(buildDemoDb());
  localStorage.removeItem(SESSION_KEY);
}

export interface AgencySession {
  staffId: string;
  agencyId: string;
}

export function getAgencySession(): AgencySession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AgencySession) : null;
  } catch {
    return null;
  }
}

export function setAgencySession(s: AgencySession | null) {
  if (!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  listeners.forEach((l) => l());
}

export function loginAgency(login: string, password: string): { error?: string; staff?: AgencyStaff } {
  const id = login.trim().toLowerCase();
  const staff = db.staff.find(
    (s) =>
      (s.login === id || s.email.toLowerCase() === id) && s.password === password
  );
  if (!staff) return { error: "Identifiants incorrects." };
  if (!staff.active) return { error: "Compte désactivé. Contactez l'administrateur de l'agence." };
  const point = staff.pointId === "principal" ? null : db.points.find((p) => p.id === staff.pointId);
  if (point && !point.active) {
    return { error: "Cette sous-agence est désactivée. Connexion impossible." };
  }
  const agency = db.agencies.find((a) => a.id === staff.agencyId);
  if (!agency || agency.status === "suspended") {
    return { error: "Agence suspendue. Contactez Easy Dunya." };
  }
  if (agency.status === "pending") {
    return { error: "Agence en attente de validation Easy Dunya." };
  }
  commit({
    ...db,
    staff: db.staff.map((s) =>
      s.id === staff.id ? { ...s, lastLogin: new Date().toISOString() } : s
    ),
  });
  setAgencySession({ staffId: staff.id, agencyId: staff.agencyId });
  return { staff };
}

export function logoutAgency() {
  setAgencySession(null);
}

export function currentStaff(): AgencyStaff | null {
  const s = getAgencySession();
  if (!s) return null;
  return db.staff.find((x) => x.id === s.staffId && x.active) ?? null;
}

export function currentAgency(): Agency | null {
  const s = getAgencySession();
  if (!s) return null;
  return db.agencies.find((a) => a.id === s.agencyId) ?? null;
}

function scopedStaff(): AgencyStaff {
  const s = currentStaff();
  if (!s) throw new Error("Non connecté");
  return s;
}

function assertPerm(perm: AgencyPerm) {
  const s = scopedStaff();
  if (!hasPerm(s, perm)) throw new Error("Autorisation insuffisante.");
}

export function publishedTripsForSearch() {
  return db.trips.filter(
    (t) =>
      t.status === "publie" &&
      new Date(t.departAt).getTime() > Date.now() &&
      freeSeatCount(db, t) > 0
  );
}

export function createAgencyByEasyDunya(args: {
  name: string;
  address: string;
  city: string;
  email: string;
  login: string;
  adminName: string;
  password: string;
}): { error?: string; agency?: Agency } {
  const slug = args.login.trim().toLowerCase().replace(/\s+/g, "");
  if (slug.length < 2) return { error: "Identifiant trop court." };
  if (db.staff.some((s) => s.login === slug || s.email.toLowerCase() === args.email.toLowerCase())) {
    return { error: "Identifiant ou e-mail déjà utilisé." };
  }
  const agency: Agency = {
    id: uid(),
    name: args.name.trim(),
    slug,
    contact: args.adminName.trim(),
    address: args.address.trim(),
    city: args.city.trim() || "Nouakchott",
    phone: null,
    whatsapp: null,
    email: args.email.trim().toLowerCase(),
    logo: null,
    cancelHours: 3,
    cancelFee: 20,
    twoFA: false,
    status: "approved",
    createdAt: new Date().toISOString(),
  };
  const admin: AgencyStaff = {
    id: uid(),
    agencyId: agency.id,
    login: slug,
    email: agency.email!,
    password: args.password,
    name: args.adminName.trim(),
    role: "admin",
    pointId: "principal",
    perms: ["vendre", "reservations", "annuler", "embarquement", "rapports"],
    active: true,
    lastLogin: null,
  };
  commit({
    ...db,
    agencies: [...db.agencies, agency],
    staff: [...db.staff, admin],
  });
  return { agency };
}

export function setAgencyStatus(id: string, status: Agency["status"]) {
  commit({
    ...db,
    agencies: db.agencies.map((a) => (a.id === id ? { ...a, status } : a)),
  });
}

export function saveAgencyProfile(patch: Partial<Agency>) {
  const a = currentAgency();
  if (!a || currentStaff()?.role !== "admin") throw new Error("Réservé à l'administrateur.");
  commit({
    ...db,
    agencies: db.agencies.map((x) => (x.id === a.id ? { ...x, ...patch } : x)),
  });
}

export function upsertVehicle(v: Omit<AgencyVehicle, "id" | "agencyId"> & { id?: string }) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const existing = v.id ? db.vehicles.find((x) => x.id === v.id) : null;
  const row: AgencyVehicle = {
    id: existing?.id ?? uid(),
    agencyId: s.agencyId,
    brand: v.brand,
    model: v.model,
    plate: v.plate,
    seats: v.seats,
    year: v.year,
    available: v.available,
    active: v.active,
  };
  const future = db.trips.filter(
    (t) =>
      t.vehicleId === row.id &&
      t.status === "publie" &&
      new Date(t.departAt).getTime() > Date.now()
  );
  if (future.length && (!row.active || !row.available)) {
    throw new Error("Impossible : véhicule affecté à un départ à venir.");
  }
  const occupied = future.reduce((m, t) => Math.max(m, t.seats - freeSeatCount(db, t)), 0);
  if (row.seats < occupied) throw new Error("Places inférieures aux sièges déjà réservés.");
  commit({
    ...db,
    vehicles: existing
      ? db.vehicles.map((x) => (x.id === row.id ? row : x))
      : [...db.vehicles, row],
  });
  return row;
}

export function upsertDriver(d: Omit<AgencyDriver, "id" | "agencyId"> & { id?: string }) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const existing = d.id ? db.drivers.find((x) => x.id === d.id) : null;
  const row: AgencyDriver = {
    id: existing?.id ?? uid(),
    agencyId: s.agencyId,
    first: d.first,
    last: d.last,
    phone: d.phone,
    photo: d.photo,
    vehicleId: d.vehicleId,
    active: d.active,
  };
  const future = db.trips.some(
    (t) =>
      t.driverId === row.id &&
      t.status === "publie" &&
      new Date(t.departAt).getTime() > Date.now()
  );
  if (future && !row.active) throw new Error("Impossible : chauffeur affecté à un départ à venir.");
  commit({
    ...db,
    drivers: existing
      ? db.drivers.map((x) => (x.id === row.id ? row : x))
      : [...db.drivers, row],
  });
  return row;
}

export function upsertPoint(p: Omit<AgencyPoint, "id" | "agencyId"> & { id?: string }) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const existing = p.id ? db.points.find((x) => x.id === p.id) : null;
  const row: AgencyPoint = {
    id: existing?.id ?? uid(),
    agencyId: s.agencyId,
    name: p.name,
    address: p.address,
    phone: p.phone,
    active: p.active,
  };
  commit({
    ...db,
    points: existing ? db.points.map((x) => (x.id === row.id ? row : x)) : [...db.points, row],
  });
  return row;
}

export function upsertStaff(args: {
  id?: string;
  name: string;
  login: string;
  email: string;
  password?: string;
  role: AgencyStaffRole;
  pointId: string;
  perms: AgencyPerm[];
  active: boolean;
}) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const login = args.login.trim().toLowerCase();
  if (db.staff.some((x) => x.login === login && x.id !== args.id)) {
    throw new Error("Identifiant déjà utilisé.");
  }
  const existing = args.id ? db.staff.find((x) => x.id === args.id) : null;
  const row: AgencyStaff = {
    id: existing?.id ?? uid(),
    agencyId: s.agencyId,
    login,
    email: args.email.trim().toLowerCase(),
    password: args.password?.trim() || existing?.password || "demo1234",
    name: args.name.trim(),
    role: args.role,
    pointId: args.pointId,
    perms: args.role === "admin" ? ["vendre", "reservations", "annuler", "embarquement", "rapports"] : args.perms,
    active: args.active,
    lastLogin: existing?.lastLogin ?? null,
  };
  commit({
    ...db,
    staff: existing ? db.staff.map((x) => (x.id === row.id ? row : x)) : [...db.staff, row],
  });
  return row;
}

export function publishTrip(args: Omit<AgencyTrip, "id" | "agencyId" | "status"> & { id?: string }) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const vehicle = db.vehicles.find((v) => v.id === args.vehicleId && v.agencyId === s.agencyId);
  if (!vehicle || !vehicle.active || !vehicle.available) throw new Error("Véhicule indisponible.");
  if (args.seats < 1 || args.seats > vehicle.seats) throw new Error("Nombre de places invalide.");
  if (new Date(args.departAt).getTime() < Date.now()) throw new Error("Date/heure dans le passé.");
  const day = args.departAt.slice(0, 10);
  const clashV = db.trips.some(
    (t) =>
      t.vehicleId === args.vehicleId &&
      t.id !== args.id &&
      t.status === "publie" &&
      sameDay(t.departAt, args.departAt)
  );
  if (clashV) throw new Error("Ce véhicule a déjà un départ ce jour-là.");
  if (args.driverId) {
    const clashD = db.trips.some(
      (t) =>
        t.driverId === args.driverId &&
        t.id !== args.id &&
        t.status === "publie" &&
        t.departAt.slice(0, 10) === day
    );
    if (clashD) throw new Error("Ce chauffeur a déjà un départ ce jour-là.");
  }
  const existing = args.id ? db.trips.find((t) => t.id === args.id) : null;
  if (existing) {
    const occ = occupiedSeatNos(db, existing.id).length;
    if (args.seats < occ) throw new Error("Places inférieures aux sièges déjà occupés.");
  }
  const row: AgencyTrip = {
    id: existing?.id ?? `agtr-${uid().slice(0, 8)}`,
    agencyId: s.agencyId,
    fromCityId: args.fromCityId,
    toCityId: args.toCityId,
    fromName: args.fromName,
    toName: args.toName,
    departAt: args.departAt,
    price: args.price,
    vehicleId: args.vehicleId,
    driverId: args.driverId,
    seats: args.seats,
    meeting: args.meeting,
    notes: args.notes,
    status: "publie",
  };
  commit({
    ...db,
    trips: existing ? db.trips.map((t) => (t.id === row.id ? row : t)) : [...db.trips, row],
  });
  return row;
}

export function cancelTrip(tripId: string, reason: string) {
  const s = scopedStaff();
  if (s.role !== "admin") throw new Error("Réservé à l'administrateur.");
  const trip = db.trips.find((t) => t.id === tripId && t.agencyId === s.agencyId);
  if (!trip) throw new Error("Départ introuvable.");
  const agency = db.agencies.find((a) => a.id === s.agencyId)!;
  const bookings = db.bookings.map((b) => {
    if (b.tripId !== tripId || (b.status !== "attente" && b.status !== "confirmee")) return b;
    const pay: AgencyPayStatus = b.pay === "paye" ? "rembourse" : b.pay === "a_payer" ? "sans" : b.pay;
    return {
      ...b,
      status: "annulee" as const,
      pay,
      refund: b.pay === "paye" ? b.total : 0,
      cancelReason: reason || "Départ annulé par l'agence",
      cancelledAt: new Date().toISOString(),
    };
  });
  void agency;
  commit({
    ...db,
    trips: db.trips.map((t) => (t.id === tripId ? { ...t, status: "annule" } : t)),
    bookings,
  });
}

export function sellSeats(args: {
  tripId: string;
  seatNos: number[];
  passenger: string;
  phone: string;
  pay: AgencyPayStatus;
  payMethod: AgencyPayMethod | null;
  channel?: AgencyChannel;
  pointId?: string;
}): AgencyBooking {
  const s = scopedStaff();
  assertPerm("vendre");
  const trip = db.trips.find((t) => t.id === args.tripId && t.agencyId === s.agencyId);
  if (!trip || trip.status !== "publie") throw new Error("Départ indisponible.");
  if (new Date(trip.departAt).getTime() < Date.now()) throw new Error("Départ déjà passé.");
  const taken = new Set(occupiedSeatNos(db, trip.id));
  for (const n of args.seatNos) {
    if (n < 1 || n > trip.seats || taken.has(n)) {
      throw new Error("Une ou plusieurs places viennent d'être vendues. Choisissez d'autres sièges.");
    }
  }
  const agency = db.agencies.find((a) => a.id === s.agencyId)!;
  const pointId =
    s.role === "admin" ? args.pointId || "principal" : s.pointId;
  const channel: AgencyChannel =
    args.channel ?? (pointId === "principal" ? "guichet" : "sous");
  const booking: AgencyBooking = {
    id: uid(),
    code: generateAgencyBookingCode(agency.slug),
    agencyId: s.agencyId,
    tripId: trip.id,
    passenger: args.passenger.trim(),
    phone: args.phone.replace(/\D/g, "").slice(0, 8),
    seats: args.seatNos.length,
    seatNos: [...args.seatNos].sort((a, b) => a - b),
    total: trip.price * args.seatNos.length,
    channel,
    pointId,
    agentId: s.id,
    status: args.pay === "a_payer" ? "attente" : "confirmee",
    pay: args.pay,
    payMethod: args.payMethod,
    createdAt: new Date().toISOString(),
    boarded: false,
    boardedAt: null,
    refund: null,
    cancelReason: null,
    cancelledAt: null,
  };
  commit({ ...db, bookings: [...db.bookings, booking] });
  return booking;
}

export function bookFromApp(args: {
  tripId: string;
  seatNos?: number[];
  seats?: number;
  passenger: string;
  phone: string;
}): AgencyBooking {
  const trip = db.trips.find((t) => t.id === args.tripId);
  if (!trip || trip.status !== "publie") throw new Error("Départ indisponible.");
  const nos =
    args.seatNos && args.seatNos.length
      ? args.seatNos
      : firstFreeSeats(db, trip, args.seats ?? 1);
  if (nos.length < (args.seats ?? nos.length)) throw new Error("Plus assez de places.");
  const taken = new Set(occupiedSeatNos(db, trip.id));
  if (nos.some((n) => taken.has(n))) throw new Error("Places déjà prises.");
  const agency = db.agencies.find((a) => a.id === trip.agencyId)!;
  const booking: AgencyBooking = {
    id: uid(),
    code: generateAgencyBookingCode(agency.slug),
    agencyId: trip.agencyId,
    tripId: trip.id,
    passenger: args.passenger.trim(),
    phone: args.phone.replace(/\D/g, "").slice(0, 8),
    seats: nos.length,
    seatNos: nos,
    total: trip.price * nos.length,
    channel: "app",
    pointId: "app",
    agentId: null,
    status: "confirmee",
    pay: "a_payer",
    payMethod: null,
    createdAt: new Date().toISOString(),
    boarded: false,
    boardedAt: null,
    refund: null,
    cancelReason: null,
    cancelledAt: null,
  };
  commit({ ...db, bookings: [...db.bookings, booking] });
  return booking;
}

export function cancelBooking(id: string, reason: string) {
  const s = scopedStaff();
  assertPerm("annuler");
  const b = db.bookings.find((x) => x.id === id && x.agencyId === s.agencyId);
  if (!b) throw new Error("Réservation introuvable.");
  if (s.role !== "admin" && b.pointId !== s.pointId) throw new Error("Hors de votre point de vente.");
  const trip = db.trips.find((t) => t.id === b.tripId)!;
  const agency = db.agencies.find((a) => a.id === s.agencyId)!;
  const { refund, pay } = refundForCancel(agency, trip, b);
  commit({
    ...db,
    bookings: db.bookings.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "annulee",
            pay,
            refund,
            cancelReason: reason,
            cancelledAt: new Date().toISOString(),
          }
        : x
    ),
  });
}

export function markPaid(id: string, method: AgencyPayMethod) {
  const s = scopedStaff();
  assertPerm("reservations");
  commit({
    ...db,
    bookings: db.bookings.map((b) =>
      b.id === id && b.agencyId === s.agencyId
        ? { ...b, pay: "paye", payMethod: method, status: b.status === "attente" ? "confirmee" : b.status }
        : b
    ),
  });
}

export function updatePassenger(id: string, passenger: string, phone: string) {
  const s = scopedStaff();
  assertPerm("reservations");
  commit({
    ...db,
    bookings: db.bookings.map((b) =>
      b.id === id && b.agencyId === s.agencyId ? { ...b, passenger, phone } : b
    ),
  });
}

export type BoardResult =
  | "ok"
  | "used"
  | "unpaid"
  | "wrong_day"
  | "cancelled"
  | "other_agency"
  | "unknown";

export function inspectTicket(code: string): { result: BoardResult; booking?: AgencyBooking; trip?: AgencyTrip } {
  const s = scopedStaff();
  assertPerm("embarquement");
  const c = code.trim().toUpperCase();
  const booking = db.bookings.find((b) => b.code.toUpperCase() === c);
  if (!booking) return { result: "unknown" };
  if (booking.agencyId !== s.agencyId) return { result: "other_agency", booking };
  const trip = db.trips.find((t) => t.id === booking.tripId);
  if (booking.status === "annulee" || trip?.status === "annule") return { result: "cancelled", booking, trip };
  if (booking.boarded) return { result: "used", booking, trip };
  const today = new Date().toISOString().slice(0, 10);
  if (trip && trip.departAt.slice(0, 10) !== today) return { result: "wrong_day", booking, trip };
  if (booking.pay === "a_payer" || booking.status === "attente") return { result: "unpaid", booking, trip };
  return { result: "ok", booking, trip };
}

export function boardTicket(id: string, collectPay?: AgencyPayMethod) {
  const s = scopedStaff();
  assertPerm("embarquement");
  commit({
    ...db,
    bookings: db.bookings.map((b) => {
      if (b.id !== id || b.agencyId !== s.agencyId) return b;
      const pay = collectPay ? ("paye" as const) : b.pay;
      const status = collectPay && b.status === "attente" ? ("confirmee" as const) : b.status;
      return {
        ...b,
        pay,
        payMethod: collectPay ?? b.payMethod,
        status,
        boarded: true,
        boardedAt: new Date().toISOString(),
      };
    }),
  });
}

export function findAgencyBookingByCode(code: string): {
  booking: AgencyBooking;
  trip: AgencyTrip;
  agency: Agency;
} | null {
  const c = code.trim().toUpperCase();
  const booking = db.bookings.find((b) => b.code.toUpperCase() === c);
  if (!booking) return null;
  const trip = db.trips.find((t) => t.id === booking.tripId);
  const agency = db.agencies.find((a) => a.id === booking.agencyId);
  if (!trip || !agency) return null;
  return { booking, trip, agency };
}

export function visibleBookings(): AgencyBooking[] {
  const s = currentStaff();
  if (!s) return [];
  return db.bookings.filter((b) => {
    if (b.agencyId !== s.agencyId) return false;
    if (s.role === "admin") return true;
    return b.pointId === s.pointId;
  });
}
