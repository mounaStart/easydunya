import { useMemo, useState } from "react";
import SeatMap from "../../components/agency/SeatMap";
import TicketCard from "../../components/agency/TicketCard";
import { useAgency } from "../../lib/agency/useAgency";
import { firstFreeSeats, freeSeatCount } from "../../lib/agency/rules";
import { sellSeats } from "../../lib/agency/store";
import type { AgencyPayMethod, AgencyPayStatus } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function AgencyGuichet() {
  const { trips, db, staff, agency, points, bookings } = useAgency();
  const upcoming = trips
    .filter((t) => t.status === "publie" && new Date(t.departAt).getTime() > Date.now())
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [tripId, setTripId] = useState(upcoming[0]?.id ?? "");
  const [dest, setDest] = useState("");
  const trip = upcoming.find((t) => t.id === tripId) ?? upcoming[0];
  const [seats, setSeats] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pay, setPay] = useState<AgencyPayStatus>("paye");
  const [method, setMethod] = useState<AgencyPayMethod>("especes");
  const [pointId, setPointId] = useState(staff?.pointId ?? "principal");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const list = useMemo(
    () => upcoming.filter((t) => !dest || t.toName === dest),
    [upcoming, dest]
  );
  const recent = bookings.filter((b) => b.channel !== "app").slice(-5).reverse();

  function pickTrip(id: string) {
    const t = upcoming.find((x) => x.id === id);
    setTripId(id);
    setSeats(t ? firstFreeSeats(db, t, 1) : []);
    setStep(2);
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
        pointId: staff?.role === "admin" ? pointId : staff?.pointId,
      });
      setDone(b.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
      setSeats(trip ? firstFreeSeats(db, trip, seats.length || 1) : []);
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
            setSeats(trip ? firstFreeSeats(db, trip, 1) : []);
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
              {[...new Set(upcoming.map((t) => t.toName))].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            {list.map((t) => {
              const free = freeSeatCount(db, t);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={free === 0}
                  onClick={() => pickTrip(t.id)}
                  className="card p-3 w-full text-left disabled:opacity-40"
                >
                  <div className="font-bold">{t.fromName} → {t.toName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.departAt).toLocaleString("fr-FR")} · {formatPrice(t.price)} · {free} places
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
            <div className="flex items-center gap-2">
              <button type="button" className="w-10 h-10 rounded-xl border" onClick={() => setSeats((s) => s.slice(0, -1))} disabled={seats.length <= 1}>−</button>
              <span className="font-extrabold w-8 text-center">{seats.length}</span>
              <button
                type="button"
                className="w-10 h-10 rounded-xl border"
                onClick={() => {
                  const next = firstFreeSeats(db, trip, seats.length + 1);
                  if (next.length > seats.length) setSeats(next);
                }}
              >
                +
              </button>
              <span className="text-sm text-slate-500">Places {seats.join(", ") || "—"}</span>
            </div>
            <SeatMap db={db} trip={trip} selected={seats} onToggle={toggle} interactive />
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
            {staff?.role === "admin" && (
              <select className="input" value={pointId} onChange={(e) => setPointId(e.target.value)}>
                <option value="principal">Guichet principal</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
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
            <p className="font-extrabold">{formatPrice(trip.price * seats.length)}</p>
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
