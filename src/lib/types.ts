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

// Stub minimal pour le client Supabase typé.
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      cities: { Row: City; Insert: Partial<City>; Update: Partial<City> };
      vehicles: { Row: Vehicle; Insert: Partial<Vehicle>; Update: Partial<Vehicle> };
      trips: { Row: Trip; Insert: Partial<Trip>; Update: Partial<Trip> };
      bookings: { Row: Booking; Insert: Partial<Booking>; Update: Partial<Booking> };
      driver_positions: {
        Row: DriverPosition;
        Insert: Partial<DriverPosition>;
        Update: Partial<DriverPosition>;
      };
    };
    Views: {
      trips_public: { Row: TripPublic };
      city_trip_counts: { Row: CityTripCount };
    };
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      driver_status: DriverStatus;
      trip_status: TripStatus;
      booking_status: BookingStatus;
    };
  };
}
