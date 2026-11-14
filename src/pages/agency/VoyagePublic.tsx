import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TicketCard from "../../components/agency/TicketCard";
import { useAuth } from "../../hooks/useAuth";
import { rememberBookingCode } from "../../hooks/useBookings";
import { bookFromApp, getAgencyDb, subscribeAgency } from "../../lib/agency/store";
import { firstFreeSeats, freeSeatCount } from "../../lib/agency/rules";
import { formatPrice } from "../../lib/utils";

export default function AgencyVoyagePublic() {
  const { tripId } = useParams();
  const { profile } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  const db = getAgencyDb();
  const trip = db.trips.find((t) => t.id === tripId);
  const agency = trip ? db.agencies.find((a) => a.id === trip.agencyId) : null;
  const free = trip ? freeSeatCount(db, trip) : 0;
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState((profile?.phone ?? "").replace(/\D/g, "").slice(-8));
  const [err, setErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const booking = db.bookings.find((b) => b.id === doneId);

  if (!trip || !agency || trip.status !== "publie") {
    return (
      <div className="page max-w-lg">
        <div className="card p-6 text-center">
          <p>Départ introuvable ou complet.</p>
          <Link to="/" className="btn-primary mt-4 inline-flex">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  if (booking) {
    return (
      <div className="page max-w-lg space-y-4">
        <TicketCard agency={agency} trip={trip} booking={booking} />
        <p className="text-sm text-slate-500">
          Présentez ce code au guichet {agency.name}. Paiement à bord / au départ.
        </p>
        <Link to="/" className="btn-ghost inline-flex">
          Accueil
        </Link>
      </div>
    );
  }

  function book() {
    if (!trip) return;
    setErr(null);
    try {
      const b = bookFromApp({
        tripId: trip.id,
        seats,
        seatNos: firstFreeSeats(db, trip, seats),
        passenger: name,
        phone,
      });
      rememberBookingCode(b.code);
      setDoneId(b.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <div className="page max-w-lg space-y-4">
      <div className="card p-5">
        <div className="text-xs font-bold uppercase tracking-wide text-brand-600">Agence {agency.name}</div>
        <h1 className="h1 mt-1">
          {trip.fromName} → {trip.toName}
        </h1>
        <p className="muted text-sm mt-1">
          {new Date(trip.departAt).toLocaleString("fr-FR")} · {formatPrice(trip.price)} / place
        </p>
        <p className="text-sm mt-2">{trip.meeting}</p>
        {trip.notes && <p className="text-sm text-slate-500 mt-1">{trip.notes}</p>}
        <p className="mt-3 font-semibold">{free} places libres</p>
      </div>
      {free <= 0 ? (
        <p className="card p-4 text-rose-700">Complet.</p>
      ) : (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-xl border"
              disabled={seats <= 1}
              onClick={() => setSeats((n) => Math.max(1, n - 1))}
            >
              −
            </button>
            <span className="font-extrabold w-8 text-center">{seats}</span>
            <button
              type="button"
              className="w-10 h-10 rounded-xl border"
              disabled={seats >= free}
              onClick={() => setSeats((n) => Math.min(free, n + 1))}
            >
              +
            </button>
            <span className="text-sm text-slate-500">Places (premiers sièges libres)</span>
          </div>
          <input className="input" placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder="Téléphone 8 chiffres"
            inputMode="numeric"
            maxLength={8}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
          />
          <p className="font-extrabold">{formatPrice(trip.price * seats)}</p>
          <p className="text-xs text-slate-400">Pas de GPS : le rendez-vous est le point de départ de l’agence.</p>
          {err && <p className="text-sm text-rose-600">{err}</p>}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={name.trim().length < 2 || phone.length !== 8}
            onClick={book}
          >
            Réserver
          </button>
        </div>
      )}
    </div>
  );
}
