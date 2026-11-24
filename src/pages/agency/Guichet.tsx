import { useMemo, useState } from "react";
import SeatMap from "../../components/agency/SeatMap";
import TicketCard from "../../components/agency/TicketCard";
import { useCities } from "../../hooks/useCities";
import { useAgency } from "../../lib/agency/useAgency";
import { FALLBACK_TRIP_CITIES } from "../../lib/agency/public";
import { firstFreeSeats, freeOnLegs, freeSeatCount, hasAnyFreeSeat } from "../../lib/agency/rules";
import { sellSeats } from "../../lib/agency/store";
import { displayFromPrice, farePrice, lastStopIndex, legLabel, tripStops } from "../../lib/agency/trip";
import type { AgencyPayMethod, AgencyPayStatus } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function AgencyGuichet() {
  const { trips, db, agency, bookings } = useAgency();
  const { tripCities } = useCities();
  const destNames = useMemo(() => {
    const list = tripCities.length ? tripCities : FALLBACK_TRIP_CITIES;
    return [...list]
      .map((c) => c.name_fr)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "fr"));
  }, [tripCities]);
  const upcoming = trips
    .filter((t) => t.status === "publie" && new Date(t.departAt).getTime() > Date.now())
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tripId, setTripId] = useState(upcoming[0]?.id ?? "");
  const [dest, setDest] = useState("");
  const trip = upcoming.find((t) => t.id === tripId) ?? upcoming[0];
  const stops = trip ? tripStops(trip) : [];
  const last = trip ? lastStopIndex(trip) : 1;
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(last);
  const [seats, setSeats] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState<AgencyPayStatus>("paye");
  const [method, setMethod] = useState<AgencyPayMethod>("especes");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const list = useMemo(
    () => upcoming.filter((t) => !dest || t.toName === dest || tripStops(t).some((s) => s.city === dest)),
    [upcoming, dest]
  );
  const recent = bookings.filter((b) => b.channel === "guichet").slice(-5).reverse();
  const unit = trip ? farePrice(trip, fromIdx, toIdx) : 0;
  const freeLeg = trip ? freeOnLegs(db, trip, fromIdx, toIdx) : 0;

  function pickTrip(id: string) {
    const t = upcoming.find((x) => x.id === id);
    setTripId(id);
    const end = t ? lastStopIndex(t) : 1;
    setFromIdx(0);
    setToIdx(end);
    setSeats(t ? firstFreeSeats(db, t, 1, 0, end) : []);
    setStep(2);
  }

  function applyLeg(from: number, to: number) {
    if (!trip || to <= from) return;
    setFromIdx(from);
    setToIdx(to);
    setSeats(firstFreeSeats(db, trip, Math.max(1, seats.length), from, to));
  }

  function toggle(n: number) {
    setSeats((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  }

  function sell() {
    setErr(null);
    if (!trip) return;
    try {
      const b = sellSeats({
        tripId: trip.id,
        seatNos: seats,
        passenger: name,
        phone,
        pay,
        payMethod: pay === "a_payer" ? null : method,
        fromIdx,
        toIdx,
      });
      setDone(b.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setSeats(trip ? firstFreeSeats(db, trip, seats.length || 1, fromIdx, toIdx) : []);
    }
  }

  const booking = bookings.find((b) => b.id === done);

  if (booking && trip && agency) {
    return (
      <div className="space-y-4 max-w-lg">
        <TicketCard agency={agency} trip={trip} booking={booking} />
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => {
            setDone(null);
            setName("");
            setPhone("");
            setSeats(trip ? firstFreeSeats(db, trip, 1, 0, lastStopIndex(trip)) : []);
            setStep(1);
          }}
        >
          Nouvelle vente
        </button>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_16rem] gap-5">
      <div>
        <div className="flex gap-2 text-xs font-bold mb-3">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`px-2 py-1 rounded-full ${step === n ? "bg-brand-600 text-white" : "bg-slate-100"}`}>
              {n}. {n === 1 ? "Départ" : n === 2 ? "Places" : "Passager"}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-2">
            <select className="input" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">Toutes destinations</option>
              {destNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            {list.map((t) => {
              const free = freeSeatCount(db, t);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!hasAnyFreeSeat(db, t)}
                  onClick={() => pickTrip(t.id)}
                  className="card p-3 w-full text-left disabled:opacity-40"
                >
                  <div className="font-bold">{t.fromName} → {t.toName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.departAt).toLocaleString("fr-FR")} · dès {formatPrice(displayFromPrice(t))} · {free} places
                    {t.stops && t.stops.length >= 3 ? ` · via ${t.stops.slice(1, -1).map((s) => s.city).join(", ")}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && trip && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setStep(1)}>←</button>
              <div className="font-bold">{trip.fromName} → {trip.toName}</div>
            </div>
            {stops.length >= 3 && (
              <div className="grid grid-cols-2 gap-2">
                <select className="input" value={fromIdx} onChange={(e) => applyLeg(Number(e.target.value), toIdx)}>
                  {stops.filter((s) => s.index < last).map((s) => (
                    <option key={s.index} value={s.index}>Montée {s.city}</option>
                  ))}
                </select>
                <select className="input" value={toIdx} onChange={(e) => applyLeg(fromIdx, Number(e.target.value))}>
                  {stops.filter((s) => s.index > fromIdx).map((s) => (
                    <option key={s.index} value={s.index}>Descente {s.city}</option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-sm font-semibold">
              {legLabel(trip, fromIdx, toIdx)} · {formatPrice(unit)} · {freeLeg} libres
            </p>
            <div className="flex items-center gap-2">
              <button type="button" className="w-10 h-10 rounded-xl border" onClick={() => setSeats((s) => s.slice(0, -1))} disabled={seats.length <= 1}>−</button>
              <span className="font-extrabold w-8 text-center">{seats.length}</span>
              <button
                type="button"
                className="w-10 h-10 rounded-xl border"
                onClick={() => {
                  const next = firstFreeSeats(db, trip, seats.length + 1, fromIdx, toIdx);
                  if (next.length > seats.length) setSeats(next);
                }}
              >
                +
              </button>
              <span className="text-sm text-slate-500">Places {seats.join(", ") || "—"}</span>
            </div>
            <SeatMap db={db} trip={trip} selected={seats} onToggle={toggle} interactive fromIdx={fromIdx} toIdx={toIdx} />
            <button type="button" className="btn-primary" disabled={!seats.length} onClick={() => setStep(3)}>
              Continuer
            </button>
          </div>
        )}

        {step === 3 && trip && (
          <div className="space-y-3 max-w-md">
            <button type="button" className="btn-ghost text-sm" onClick={() => setStep(2)}>← Places</button>
            <input className="input" placeholder="Nom du passager" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Téléphone 8 chiffres" inputMode="numeric" maxLength={8} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
            <select className="input" value={pay} onChange={(e) => setPay(e.target.value as AgencyPayStatus)}>
              <option value="paye">Encaisser maintenant</option>
              <option value="a_payer">Réserver sans paiement</option>
            </select>
            {pay === "paye" && (
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value as AgencyPayMethod)}>
                <option value="especes">Espèces</option>
                <option value="bankily">Bankily</option>
                <option value="masrvi">Masrvi</option>
                <option value="sedad">Sedad</option>
              </select>
            )}
            <p className="font-extrabold">{formatPrice(unit * seats.length)}</p>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <button type="button" className="btn-primary w-full" disabled={name.trim().length < 2 || phone.length !== 8} onClick={sell}>
              Valider la vente
            </button>
          </div>
        )}
      </div>
      <aside>
        <h3 className="text-sm font-bold mb-2">Dernières ventes</h3>
        <div className="space-y-2">
          {recent.map((b) => (
            <div key={b.id} className="card p-2 text-xs">
              <div className="font-semibold">{b.passenger}</div>
              <div className="text-slate-500">{b.code} · {formatPrice(b.total)}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
