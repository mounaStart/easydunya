// =====================================================================
// Types partagés entre frontend et Supabase.
// Le type `Database` reste léger : on type les rows métier essentiels,
// le reste est `any` pour ne pas bloquer le build sans `supabase gen types`.
// =====================================================================

export type UserRole = "passenger" | "driver" | "admin";
export type DriverStatus = "pending" | "approved" | "rejected" | "suspended";
export type TripStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "cancelled"
  | "completed";

export interface City {
  id: string;
  name_fr: string;
  name_ar: string;
  region: string | null;
  latitude: number;
  longitude: number;
}

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  preferred_lang: string;
  driver_status: DriverStatus | null;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  make: string;
  model: string;
  plate: string;
  seats: number;
  features: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  from_city_id: string;
  to_city_id: string;
  depart_at: string;
  price_per_seat: number;
  seats_total: number;
  seats_available: number;
  notes: string | null;
  status: TripStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface TripPublic extends Trip {
  driver_name: string | null;
  driver_rating: number | null;
  driver_rating_count: number;
  vehicle_label: string | null;
  vehicle_plate: string | null;
  vehicle_seats: number | null;
  from_name_fr: string;
  from_name_ar: string;
  from_lat: number;
  from_lng: number;
  to_name_fr: string;
  to_name_ar: string;
  to_lat: number;
  to_lng: number;
}

export interface Booking {
  id: string;
  trip_id: string;
  passenger_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  seats: number;
  confirmation_code: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminStats {
  users_count: number;
  drivers_count: number;
  drivers_pending: number;
  drivers_approved: number;
  drivers_suspended: number;
  passengers_count: number;
  trips_count: number;
  trips_scheduled: number;
  trips_in_progress: number;
  trips_completed: number;
  bookings_count: number;
  bookings_pending: number;
  bookings_confirmed: number;
  gross_revenue: number;
  commission_revenue: number;
}

export interface DriverAdmin {
  id: string;
  full_name: string | null;
  phone: string | null;
  driver_status: DriverStatus | null;
  rating_avg: number | null;
  rating_count: number;
  license_number: string | null;
  base_city_id: string | null;
  base_city_name: string | null;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  trips_total: number;
  vehicles_total: number;
}

export interface UserAdmin {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  driver_status: DriverStatus | null;
  created_at: string;
  email: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

export interface CityTripCount {
  id: string;
  name_fr: string;
  name_ar: string;
  latitude: number;
  longitude: number;
  upcoming_trips: number;
}

export interface DriverPosition {
  id: number;
  trip_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

// Schéma Database simplifié pour ne pas bloquer le build sans `supabase gen types`.
// On laisse les tables/views/functions en `any` : le code TypeScript reste typé
// via les interfaces Row exposées ci-dessus (City, Profile, Trip, etc.).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
