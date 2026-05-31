import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../../lib/supabase";
import { updateBookingStatus, useTripBookings } from "../../hooks/useBookings";
import type { Booking, Profile, TripPublic } from "../../lib/types";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import {
  formatPrice,
  formatTime,
  relativeDateLabel,
} from "../../lib/utils";

export default function TripBookings() {
  const { tripId } = useParams();
  const { t, i18n } = useTranslation();
  const { bookings, loading, refresh } = useTripBookings(tripId);
  const [trip, setTrip] = useState<TripPublic | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    if (!tripId) return;
    supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle()
      .then(({ data }) => setTrip((data as TripPublic | null) ?? null));
  }, [tripId]);

  useEffect(() => {
    const ids = bookings
      .map((b) => b.passenger_id)
      .filter((x): x is string => !!x);
    if (ids.length === 0) return;
    supabase
      .from("profiles")
      .select("*")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, Profile> = {};
        (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
        setProfiles(map);
      });
  }, [bookings]);

  async function setStatus(b: Booking, status: Booking["status"]) {
    await updateBookingStatus(b.id, status);
    refresh();
  }

  async function startTrip() {
    if (!tripId) return;
    await supabase
      .from("trips")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", tripId);
    const { data } = await supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();
    setTrip((data as TripPublic | null) ?? null);
  }

  async function endTrip() {
    if (!tripId) return;
    await supabase
      .from("trips")
      .update({ status: "completed", ended_at: new Date().toISOString() })
      .eq("id", tripId);
    const { data } = await supabase
      .from("trips_public")
      .select("*")
      .eq("id", tripId)
      .maybeSingle();
    setTrip((data as TripPublic | null) ?? null);
  }

  if (!trip) return <Spinner />;
  const isAr = i18n.language === "ar";

  return (
    <div className="page max-w-3xl">
      <Link to="/driver" className="text-sm text-brand-700 hover:underline">
        ← {t("nav.dashboard")}
      </Link>

      <div className="card p-5 mt-3 mb-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <span className="chip">{relativeDateLabel(trip.depart_at)}</span>
          <StatusBadge status={trip.status} kind="trip" />
        </div>
        <h1 className="h2">
          {(isAr ? trip.from_name_ar : trip.from_name_fr)} →{" "}
          {(isAr ? trip.to_name_ar : trip.to_name_fr)}
        </h1>
        <div className="muted">
          {formatTime(trip.depart_at)} · {formatPrice(trip.price_per_seat)}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          {trip.status === "scheduled" && (
            <button onClick={startTrip} className="btn-primary">
              ▶ {t("driver.startTrip")}
            </button>
          )}
          {trip.status === "in_progress" && (
            <button onClick={endTrip} className="btn-secondary">
              ■ {t("driver.endTrip")}
            </button>
          )}
        </div>
      </div>

      <h2 className="h2 mb-3">{t("driver.bookings")}</h2>
      {loading ? (
        <Spinner />
      ) : bookings.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          {t("common.noResults")}
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => {
            const profile = b.passenger_id ? profiles[b.passenger_id] : null;
            const name = b.guest_name ?? profile?.full_name ?? "—";
            const phone = b.guest_phone ?? profile?.phone ?? null;
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{name}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="muted">
                      {b.seats} {t("common.seats").toLowerCase()} · code{" "}
                      <span className="code-display font-bold text-brand-700">
                        {b.confirmation_code}
                      </span>
                    </div>
                  </div>
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="btn-secondary text-sm"
                      title={t("driver.callPassenger")}
                    >
                      📞 {phone}
                    </a>
                  )}
                </div>

                {b.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setStatus(b, "confirmed")}
                      className="btn-primary text-sm flex-1"
                    >
                      ✓ {t("common.confirm")}
                    </button>
                    <button
                      onClick={() => setStatus(b, "rejected")}
                      className="btn-ghost text-rose-700 text-sm flex-1"
                    >
                      ✕ {t("common.refuse")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
