import { useMemo, useState, type FormEvent } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { cancelTrip, publishTrip } from "../../lib/agency/store";
import { DISPLAY_STATUS_LABEL, freeSeatCount, tripDisplayStatus } from "../../lib/agency/rules";
import { SUGGESTED_FARES } from "../../lib/agency/types";
import { buildFares } from "../../lib/agency/trip";
import type { AgencyStop } from "../../lib/agency/types";
import { useCities } from "../../hooks/useCities";
import { FALLBACK_TRIP_CITIES } from "../../lib/agency/public";
import { formatPrice } from "../../lib/utils";

type Tab = "venir" | "passes" | "annules";

export default function AgencyDeparts() {
  const { trips, vehicles, drivers, agency, db } = useAgency();
  const { tripCities } = useCities();
  const cities = tripCities.length ? tripCities : FALLBACK_TRIP_CITIES;
  const [tab, setTab] = useState<Tab>("venir");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    return trips.filter((t) => {
      if (tab === "annules") return t.status === "annule";
      if (tab === "passes") return t.status === "publie" && new Date(t.departAt).getTime() < now;
      return t.status === "publie" && new Date(t.departAt).getTime() >= now;
    }).filter((t) =>
      !q || `${t.fromName} ${t.toName}`.toLowerCase().includes(q.toLowerCase())
    );
  }, [trips, tab, q]);

  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["venir", "passes", "annules"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              tab === k ? "bg-brand-600 text-white" : "bg-white ring-1 ring-slate-200"
            }`}
          >
            {k === "venir" ? "À venir" : k === "passes" ? "Passés" : "Annulés"}
          </button>
        ))}
        <input className="input flex-1 min-w-[8rem] text-sm" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
          Publier
        </button>
      </div>
      <div className="space-y-2">
        {filtered.map((t) => {
          const st = tripDisplayStatus(db, t);
          const v = vehicles.find((x) => x.id === t.vehicleId);
          const d = drivers.find((x) => x.id === t.driverId);
          return (
            <div key={t.id} className="card p-4">
              <div className="flex justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-bold">
                    {t.fromName} → {t.toName}
                    {t.stops && t.stops.length >= 3 ? (
                      <span className="font-normal text-xs text-slate-500"> via {t.stops.slice(1, -1).map((s) => s.city).join(", ")}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.departAt).toLocaleString("fr-FR")} · {formatPrice(t.price)} · {freeSeatCount(db, t)}/{t.seats} lib. · {v?.plate} · {d ? `${d.first} ${d.last}` : "Sans chauffeur"}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{t.meeting}</div>
                </div>
                {tab === "venir" && (
                  <button
                    type="button"
                    className="btn-ghost text-rose-700 text-xs"
                    onClick={() => {
                      if (!confirm("Annuler ce départ ? Toutes les réservations confirmées seront remboursées.")) return;
                      try {
                        cancelTrip(t.id, "Annulé par l'agence");
                      } catch (e) {
                        alert(e instanceof Error ? e.message : "Erreur");
                      }
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
              <div className="text-[10px] mt-1 font-bold text-slate-400 uppercase">{DISPLAY_STATUS_LABEL[st]}</div>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="muted text-sm">Aucun départ.</p>}
      </div>

      {open && (
        <PublishModal
          cities={cities}
          vehicles={vehicles.filter((v) => v.active && v.available)}
          drivers={drivers.filter((d) => d.active)}
          defaultMeeting={agency?.address ?? "Gare routière"}
          onClose={() => setOpen(false)}
          err={err}
          setErr={setErr}
        />
      )}
    </div>
  );
}

function PublishModal({
  cities,
  vehicles,
  drivers,
  defaultMeeting,
  onClose,
  err,
  setErr,
}: {
  cities: { id: string; name_fr: string }[];
  vehicles: { id: string; brand: string; model: string; plate: string; seats: number }[];
  drivers: { id: string; first: string; last: string }[];
  defaultMeeting: string;
  onClose: () => void;
  err: string | null;
  setErr: (s: string | null) => void;
}) {
  const [fromId, setFromId] = useState(cities[0]?.id ?? "");
  const [toId, setToId] = useState(cities[1]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("07:00");
  const [price, setPrice] = useState(700);
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? "");
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? "");
  const [seats, setSeats] = useState(vehicles[0]?.seats ?? 14);
  const [meeting, setMeeting] = useState(defaultMeeting);
  const [notes, setNotes] = useState("");
  const [via, setVia] = useState<string[]>([]);
  const [viaPick, setViaPick] = useState("");

  const fromName = cities.find((c) => c.id === fromId)?.name_fr ?? "";
  const toName = cities.find((c) => c.id === toId)?.name_fr ?? "";
  const suggest = fromName === "Nouakchott" ? SUGGESTED_FARES[toName] : undefined;

  function onVehicle(id: string) {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setSeats(v.seats);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const departAt = new Date(`${date}T${time}:00`).toISOString();
      const viaCities = via
        .map((id) => cities.find((c) => c.id === id))
        .filter((c): c is { id: string; name_fr: string } => !!c);
      let stops: AgencyStop[] | null = null;
      let fares: Record<string, number> | null = null;
      if (viaCities.length) {
        const all = [
          { id: fromId, name_fr: fromName },
          ...viaCities,
          { id: toId, name_fr: toName },
        ];
        stops = all.map((c, i) => ({
          index: i,
          cityId: c.id,
          city: c.name_fr,
          time: i === 0 ? time : null,
        }));
        fares = buildFares(stops);
      }
      const endFare = stops && fares ? fares[`0-${stops.length - 1}`] : undefined;
      publishTrip({
        fromCityId: fromId,
        toCityId: toId,
        fromName,
        toName,
        departAt,
        price: endFare ?? price,
        vehicleId,
        driverId: driverId || null,
        seats,
        meeting,
        notes: notes || null,
        stops,
        fares,
      });
      onClose();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
      <form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="h2">Publier un départ</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
          <select className="input" value={toId} onChange={(e) => setToId(e.target.value)} required>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
          </select>
          <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="input" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
          <input className="input" type="number" min={50} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          <select className="input" value={vehicleId} onChange={(e) => onVehicle(e.target.value)}>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate} ({v.seats})</option>)}
          </select>
          <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            <option value="">Sans chauffeur</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.first} {d.last}</option>)}
          </select>
          <input className="input" type="number" min={1} max={60} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
        </div>
        {suggest && (
          <p className="text-xs text-brand-700">Tarif habituel {formatPrice(suggest.price)} · ~{suggest.hours} h (modifiable)</p>
        )}
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-500">Arrêts en route (optionnel)</div>
          <div className="flex gap-2">
            <select className="input flex-1" value={viaPick} onChange={(e) => setViaPick(e.target.value)}>
              <option value="">Ajouter une ville</option>
              {cities
                .filter((c) => c.id !== fromId && c.id !== toId && !via.includes(c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name_fr}</option>
                ))}
            </select>
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={() => {
                if (viaPick) setVia((v) => [...v, viaPick]);
                setViaPick("");
              }}
            >
              Ajouter
            </button>
          </div>
          {via.map((id, i) => (
            <div key={id} className="flex justify-between text-sm">
              <span>{i + 1}. {cities.find((c) => c.id === id)?.name_fr}</span>
              <button type="button" className="text-rose-600 text-xs" onClick={() => setVia((v) => v.filter((x) => x !== id))}>Retirer</button>
            </div>
          ))}
        </div>
        <input className="input" value={meeting} onChange={(e) => setMeeting(e.target.value)} placeholder="Point de départ exact" required />
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose}>Fermer</button>
          <button type="submit" className="btn-primary">Publier</button>
        </div>
      </form>
    </div>
  );
}
