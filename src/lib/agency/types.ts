export type AgencyStaffRole = "admin" | "agent";
export type AgencyPerm =
  | "vendre"
  | "reservations"
  | "annuler"
  | "embarquement"
  | "rapports";
export type AgencyChannel = "app" | "guichet" | "sous";
export type AgencyTripStatus = "publie" | "annule";
export type AgencyBookingStatus = "attente" | "confirmee" | "annulee" | "terminee";
export type AgencyPayStatus =
  | "paye"
  | "a_payer"
  | "rembourse"
  | "rembourse_partiel"
  | "sans";
export type AgencyPayMethod = "especes" | "bankily" | "masrvi" | "sedad";

export const AGENCY_PERMS: AgencyPerm[] = [
  "vendre",
  "reservations",
  "annuler",
  "embarquement",
  "rapports",
];

export const PERM_PRESETS: Record<string, { label: string; perms: AgencyPerm[] }> = {
  vendeur: {
    label: "Vendeur guichet",
    perms: ["vendre", "reservations"],
  },
  responsable: {
    label: "Responsable point de vente",
    perms: ["vendre", "reservations", "annuler", "rapports"],
  },
  controleur: {
    label: "Contrôleur d'embarquement",
    perms: ["embarquement", "reservations"],
  },
};

export interface Agency {
  id: string;
  name: string;
  slug: string;
  contact: string | null;
  address: string;
  city: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  logo: string | null;
  cancelHours: number;
  cancelFee: number;
  twoFA: boolean;
  status: "pending" | "approved" | "suspended";
  createdAt: string;
}

export interface AgencyPoint {
  id: string;
  agencyId: string;
  name: string;
  address: string;
  phone: string | null;
  active: boolean;
}

export interface AgencyStaff {
  id: string;
  agencyId: string;
  login: string;
  email: string;
  password: string;
  name: string;
  role: AgencyStaffRole;
  pointId: string;
  perms: AgencyPerm[];
  active: boolean;
  lastLogin: string | null;
}

export interface AgencyVehicle {
  id: string;
  agencyId: string;
  brand: string;
  model: string;
  plate: string;
  seats: number;
  year: number;
  available: boolean;
  active: boolean;
}

export interface AgencyDriver {
  id: string;
  agencyId: string;
  first: string;
  last: string;
  phone: string;
  photo: string | null;
  vehicleId: string | null;
  active: boolean;
}

export interface AgencyTrip {
  id: string;
  agencyId: string;
  fromCityId: string;
  toCityId: string;
  fromName: string;
  toName: string;
  departAt: string;
  price: number;
  vehicleId: string;
  driverId: string | null;
  seats: number;
  meeting: string;
  notes: string | null;
  status: AgencyTripStatus;
}

export interface AgencyBooking {
  id: string;
  code: string;
  agencyId: string;
  tripId: string;
  passenger: string;
  phone: string;
  seats: number;
  seatNos: number[];
  total: number;
  channel: AgencyChannel;
  pointId: string;
  agentId: string | null;
  status: AgencyBookingStatus;
  pay: AgencyPayStatus;
  payMethod: AgencyPayMethod | null;
  createdAt: string;
  boarded: boolean;
  boardedAt: string | null;
  refund: number | null;
  cancelReason: string | null;
  cancelledAt: string | null;
}

export interface AgencyDB {
  agencies: Agency[];
  points: AgencyPoint[];
  staff: AgencyStaff[];
  vehicles: AgencyVehicle[];
  drivers: AgencyDriver[];
  trips: AgencyTrip[];
  bookings: AgencyBooking[];
}

export const CHANNEL_COLOR: Record<AgencyChannel, string> = {
  app: "#1565B8",
  guichet: "#F57C1F",
  sous: "#7B5BD0",
};

export const CHANNEL_LABEL: Record<AgencyChannel, string> = {
  app: "Application",
  guichet: "Guichet",
  sous: "Sous-agence",
};

export const SUGGESTED_FARES: Record<string, { price: number; hours: number }> = {
  Rosso: { price: 300, hours: 3 },
  Akjoujt: { price: 300, hours: 3 },
  Aleg: { price: 450, hours: 4 },
  Boghé: { price: 700, hours: 6 },
  Atar: { price: 750, hours: 6 },
  Nouadhibou: { price: 800, hours: 6 },
  Kaédi: { price: 800, hours: 7 },
  Kiffa: { price: 1000, hours: 8 },
  Tidjikja: { price: 1000, hours: 8 },
  Sélibaby: { price: 1100, hours: 9 },
  Zouérate: { price: 1200, hours: 10 },
  Aïoun: { price: 1400, hours: 12 },
  Néma: { price: 1700, hours: 16 },
};
