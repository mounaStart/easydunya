import { useState } from "react";
import SeatMap from "../../components/agency/SeatMap";
import { useAgency } from "../../lib/agency/useAgency";
import { freeSeatCount, occupancyBySegment, seatsByChannel } from "../../lib/agency/rules";
import { lastStopIndex, tripStops } from "../../lib/agency/trip";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "../../lib/agency/types";

export default function AgencyPlaces() {
  const { trips, db } = useAgency();
  const upcoming = trips
    .filter((t) => t.status === "publie" && new Date(t.departAt).getTime() > Date.now())
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  const [id, setId] = useState(upcoming[0]?.id ?? "");
  const trip = trips.find((t) => t.id === id) ?? upcoming[0];
  const ch = trip ? seatsByChannel(db, trip.id) : null;
  const segs = trip ? occupancyBySegment(db, trip) : [];
  const stops = trip ? tripStops(trip) : [];
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(trip ? lastStopIndex(trip) : 1);

  return (
    <div className="space-y-4">
      <select
        className="input"
        value={trip?.id ?? ""}
        onChange={(e) => {
          setId(e.target.value);
          const t = trips.find((x) => x.id === e.target.value);
          if (t) {
            setFromIdx(0);
            setToIdx(lastStopIndex(t));
          }
        }}
      >
        {upcoming.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fromName} → {t.toName} · {new Date(t.departAt).toLocaleString("fr-FR")} · {freeSeatCount(db, t)} lib.
          </option>
        ))}
      </select>
      {!trip ? (
        <p className="muted">Aucun départ à venir.</p>
      ) : (
        <>
          {stops.length >= 3 && (
            <div className="grid grid-cols-2 gap-2">
              <select
                className="input"
                value={fromIdx}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setFromIdx(next);
                  if (toIdx <= next) setToIdx(next + 1);
                }}
              >
                {stops.filter((s) => s.index < lastStopIndex(trip)).map((s) => (
                  <option key={s.index} value={s.index}>Montée {s.city}</option>
                ))}
              </select>
              <select className="input" value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))}>
                {stops.filter((s) => s.index > fromIdx).map((s) => (
                  <option key={s.index} value={s.index}>Descente {s.city}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs font-semibold">
            {(["app", "guichet"] as const).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                <i className="w-3 h-3 rounded-sm inline-block" style={{ background: CHANNEL_COLOR[c] }} />
                {CHANNEL_LABEL[c]} {ch?.[c]}
              </span>
            ))}
            <span>Libre {ch?.libre}</span>
            <span className="text-slate-400">Hachuré = en attente</span>
          </div>
          <div className="card p-4 overflow-x-auto">
            <SeatMap db={db} trip={trip} fromIdx={fromIdx} toIdx={toIdx} />
          </div>
          {segs.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1">Tronçon</th>
                  <th>Occupées</th>
                  <th>Libres</th>
                </tr>
              </thead>
              <tbody>
                {segs.map((s) => (
                  <tr key={`${s.from}-${s.to}`} className="border-t border-slate-100">
                    <td className="py-2">{s.from} → {s.to}</td>
                    <td>{s.occupied}</td>
                    <td>{s.free}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
