import { useState } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { boardTicket, inspectTicket } from "../../lib/agency/store";
import { CHANNEL_COLOR } from "../../lib/agency/types";

const MSG: Record<string, string> = {
  ok: "Ticket valide — embarquement enregistré.",
  used: "Déjà embarqué.",
  unpaid: "Non payé. Encaissez avant d'embarquer, ou confirmez l'encaissement.",
  wrong_day: "Ce ticket n'est pas pour aujourd'hui.",
  cancelled: "Réservation ou départ annulé.",
  other_agency: "Ticket d'une autre agence.",
  unknown: "Code inconnu.",
};

export default function AgencyEmbarquement() {
  const { trips, bookings } = useAgency();
  const upcoming = trips
    .filter((t) => t.status === "publie")
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  const [tripId, setTripId] = useState(upcoming[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [unpaidId, setUnpaidId] = useState<string | null>(null);
  const trip = trips.find((t) => t.id === tripId) ?? upcoming[0];
  const list = bookings.filter((b) => b.tripId === trip?.id && b.status !== "annulee");

  function scan() {
    setUnpaidId(null);
    const r = inspectTicket(code);
    const validForTrip = !r.trip || !trip || r.trip.id === trip.id;
    if (r.result === "ok" && r.booking && validForTrip) {
      boardTicket(r.booking.id);
      setOk(true);
      setMsg(MSG.ok);
      setCode("");
      return;
    }
    if (r.result === "ok" && r.trip && trip && r.trip.id !== trip.id) {
      setOk(false);
      setMsg(`Ce ticket est pour ${r.trip.fromName} → ${r.trip.toName}.`);
      return;
    }
    if (r.result === "unpaid" && r.booking) {
      setUnpaidId(r.booking.id);
    }
    setOk(r.result === "ok");
    setMsg(MSG[r.result] ?? r.result);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <select className="input" value={trip?.id ?? ""} onChange={(e) => setTripId(e.target.value)}>
        {upcoming.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fromName} → {t.toName} · {new Date(t.departAt).toLocaleString("fr-FR")}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Code ED-XXX-YYYYY"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && scan()}
        />
        <button type="button" className="btn-primary" onClick={scan}>
          Contrôler
        </button>
      </div>
      {msg && (
        <div className={`card p-3 font-semibold ${ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {msg}
        </div>
      )}
      {unpaidId && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            boardTicket(unpaidId, "especes");
            setUnpaidId(null);
            setOk(true);
            setMsg("Encaissé en espèces et embarqué.");
          }}
        >
          Encaisser (espèces) et embarquer
        </button>
      )}
      <p className="text-xs text-slate-400">La caméra QR sera branchée plus tard. Saisissez le code pour l’instant.</p>
      <ul className="space-y-1">
        {list.map((b) => (
          <li key={b.id} className="flex justify-between text-sm card px-3 py-2">
            <span>
              {b.passenger}{" "}
              <span className="text-[10px]" style={{ color: CHANNEL_COLOR[b.channel] }}>
                {b.channel}
              </span>
            </span>
            <span className={b.boarded ? "text-emerald-700 font-bold" : "text-slate-400"}>
              {b.boarded ? "Embarqué" : "À bord"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
