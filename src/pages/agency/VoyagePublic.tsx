import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import TicketCard from "../../components/agency/TicketCard";
import { useAuth } from "../../hooks/useAuth";
import { rememberBookingCode } from "../../hooks/useBookings";
import { stopIndicesForRoute } from "../../lib/agency/public";
import { bookFromApp, getAgencyDb, subscribeAgency } from "../../lib/agency/store";
import { firstFreeSeats, freeOnLegs, freeSeatCount } from "../../lib/agency/rules";
import { displayFromPrice, farePrice, lastStopIndex, tripStops } from "../../lib/agency/trip";
import { formatPrice } from "../../lib/utils";

export default function AgencyVoyagePublic() {
  const { tripId } = useParams();
  const [search] = useSearchParams();
  const { profile } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  const db = getAgencyDb();
  const trip = db.trips.find((t) => t.id === tripId);
  const agency = trip ? db.agencies.find((a) => a.id === trip.agencyId) : null;
  const stops = trip ? tripStops(trip) : [];
  const last = trip ? lastStopIndex(trip) : 1;
  const fromQ = search.get("from") || undefined;
  const toQ = search.get("to") || undefined;
  const seeded = trip ? stopIndicesForRoute(trip, fromQ, toQ) : null;
  const [fromIdx, setFromIdx] = useState(seeded?.fromIdx ?? 0);
  const [toIdx, setToIdx] = useState(seeded?.toIdx ?? last);
  const [seats, setSeats] = useState(1);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState((profile?.phone ?? "").replace(/\D/g, "").slice(-8));
  const [err, setErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const booking = db.bookings.find((b) => b.id === doneId);

  useEffect(() => {
    if (!trip) return;
    const next = stopIndicesForRoute(trip, fromQ, toQ);
    setFromIdx(next?.fromIdx ?? 0);
    setToIdx(next?.toIdx ?? lastStopIndex(trip));
  }, [trip?.id, fromQ, toQ]);

  if (!trip || !agency || trip.status !== "publie") {
    return (
      <div className="page max-w-lg">
        <div className="card p-6 text-center">
          <p>Départ introuvable ou complet.</p>
          <Link to="/" className="btn-primary mt-4 inline-flex">Retour</Link>
        </div>
      </div>
    );
  }

  const unit = farePrice(trip, fromIdx, toIdx);
  const freeLeg = freeOnLegs(db, trip, fromIdx, toIdx);
  const freeShown = freeSeatCount(db, trip);

  if (booking) {
    return (
      <div className="page max-w-lg space-y-4">
        <TicketCard agency={agency} trip={trip} booking={booking} />
        <p className="text-sm text-slate-500">
          Présentez ce code au guichet {agency.name}. Paiement à bord / au départ.
        </p>
        <Link to="/" className="btn-ghost inline-flex">Accueil</Link>
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
        seatNos: firstFreeSeats(db, trip, seats, fromIdx, toIdx),
        passenger: name,
        phone,
        fromIdx,
        toIdx,
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
        <h1 className="h1 mt-1">{trip.fromName} → {trip.toName}</h1>
        <p className="muted text-sm mt-1">
          {new Date(trip.departAt).toLocaleString("fr-FR")} · dès {formatPrice(displayFromPrice(trip))}
        </p>
        <p className="text-sm mt-2">{trip.meeting}</p>
        {stops.length >= 3 && (
          <ol className="mt-3 text-sm space-y-1">
            {stops.map((s) => (
              <li key={s.index} className="flex justify-between">
                <span>{s.city}</span>
                <span className="text-slate-400">{s.time ?? ""}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 font-semibold">{freeShown} places (tronçon le plus chargé)</p>
      </div>
      <div className="card p-5 space-y-3">
        {stops.length >= 3 && (
          <div className="grid grid-cols-2 gap-2">
            <select
              className="input"
              value={fromIdx}
              onChange={(e) => {
                const next = Number(e.target.value);
                setFromIdx(next);
                if (toIdx <= next) setToIdx(next + 1);
                setSeats(1);
              }}
            >
              {stops.filter((s) => s.index < last).map((s) => (
                <option key={s.index} value={s.index}>Montée {s.city}</option>
              ))}
            </select>
            <select className="input" value={toIdx} onChange={(e) => { setToIdx(Number(e.target.value)); setSeats(1); }}>
              {stops.filter((s) => s.index > fromIdx).map((s) => (
                <option key={s.index} value={s.index}>Descente {s.city}</option>
              ))}
            </select>
          </div>
        )}
        <p className="text-sm font-semibold">{formatPrice(unit)} / place · {freeLeg} libres sur ce trajet</p>
        <div className="flex items-center gap-3">
          <button type="button" className="w-10 h-10 rounded-xl border" disabled={seats <= 1} onClick={() => setSeats((n) => Math.max(1, n - 1))}>−</button>
          <span className="font-extrabold w-8 text-center">{seats}</span>
          <button type="button" className="w-10 h-10 rounded-xl border" disabled={seats >= freeLeg} onClick={() => setSeats((n) => Math.min(freeLeg, n + 1))}>+</button>
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
        <p className="font-extrabold">{formatPrice(unit * seats)}</p>
        <p className="text-xs text-slate-400">Pas de GPS : rendez-vous au point de départ de l’agence.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button type="button" className="btn-primary w-full" disabled={name.trim().length < 2 || phone.length !== 8 || freeLeg < 1} onClick={book}>
          Réserver
        </button>
      </div>
    </div>
  );
}
