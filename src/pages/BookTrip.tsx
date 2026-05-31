import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTrip } from "../hooks/useTrips";
import { useAuth } from "../hooks/useAuth";
import { createBooking } from "../hooks/useBookings";
import type { Booking } from "../lib/types";
import Spinner from "../components/Spinner";
import ConfirmationCode from "../components/ConfirmationCode";
import { formatPrice, formatTime, relativeDateLabel } from "../lib/utils";

export default function BookTrip() {
  const { tripId } = useParams();
  const { trip, loading } = useTrip(tripId);
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation();

  const [seats, setSeats] = useState(1);
  const [guestName, setGuestName] = useState(profile?.full_name ?? "");
  const [guestPhone, setGuestPhone] = useState(profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (!trip) {
    return (
      <div className="page">
        <p className="card p-6 text-center text-slate-500">
          {t("common.noResults")}
        </p>
      </div>
    );
  }

  const isAr = i18n.language === "ar";
  const fromName = isAr ? trip.from_name_ar : trip.from_name_fr;
  const toName = isAr ? trip.to_name_ar : trip.to_name_fr;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!trip) return;
    setBusy(true);
    setError(null);
    const { booking, error } = await createBooking({
      tripId: trip.id,
      seats,
      passengerId: user ? user.id : null,
      guestName: user ? undefined : guestName,
      guestPhone: user ? undefined : guestPhone,
    });
    setBusy(false);
    if (error || !booking) {
      setError(error ?? t("booking.createError"));
      return;
    }
    setBooking(booking);
  }

  if (booking) {
    return (
      <div className="page max-w-md">
        <ConfirmationCode
          code={booking.confirmation_code}
          passengerName={user ? profile?.full_name ?? undefined : guestName}
          fromName={fromName}
          toName={toName}
        />
        <div className="mt-4 flex flex-col gap-2">
          <Link to="/" className="btn-secondary">
            {t("common.back")}
          </Link>
          {user && (
            <Link to="/me/bookings" className="btn-ghost">
              {t("nav.bookings")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page max-w-md">
      <div className="card p-5 mb-4">
        <div className="text-sm text-slate-500">{relativeDateLabel(trip.depart_at)} · {formatTime(trip.depart_at)}</div>
        <div className="text-lg font-bold">{fromName} → {toName}</div>
        <div className="text-sm text-brand-700 font-semibold mt-1">
          {formatPrice(trip.price_per_seat)} / {t("common.seats")}
        </div>
      </div>

      <div className="card p-6">
        <h1 className="h2 mb-1">
          {user ? t("trip.bookLogged") : t("booking.guestTitle")}
        </h1>
        {!user && (
          <p className="muted mb-4">{t("booking.guestSubtitle")}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!user && (
            <>
              <div>
                <label className="label">{t("common.fullName")}</label>
                <input
                  className="input"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t("common.phone")}</label>
                <input
                  className="input"
                  required
                  placeholder="+222…"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </div>
            </>
          )}
          <div>
            <label className="label">{t("common.seats")}</label>
            <input
              type="number"
              className="input"
              min={1}
              max={trip.seats_available}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
            <p className="muted mt-1">
              {trip.seats_available} {t("common.seatsAvailable")}
            </p>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? t("common.loading") : t("trip.bookSeat")}
          </button>

          {!user && (
            <p className="text-xs text-slate-500 text-center">
              <Link to="/login" className="text-brand-700 font-semibold">
                {t("auth.signIn")}
              </Link>{" "}
              · {t("auth.noAccount")}{" "}
              <Link to="/register" className="text-brand-700 font-semibold">
                {t("auth.signUp")}
              </Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
