import { useState, type FormEvent } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { upsertVehicle } from "../../lib/agency/store";

export default function AgencyVehicules() {
  const { vehicles } = useAgency();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("Toyota");
  const [model, setModel] = useState("Hiace");
  const [year, setYear] = useState(2018);
  const [plate, setPlate] = useState("");
  const [seats, setSeats] = useState(14);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      upsertVehicle({ brand, model, year, plate, seats, available: true, active: true });
      setOpen(false);
      setPlate("");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button type="button" className="btn-primary text-sm" onClick={() => setOpen(true)}>
          Ajouter
        </button>
      </div>
      <div className="space-y-2">
        {vehicles.map((v) => (
          <div key={v.id} className="card p-3 flex justify-between items-center">
            <div>
              <div className="font-bold">
                {v.brand} {v.model} {v.year}
              </div>
              <div className="text-xs text-slate-500">
                {v.plate} · {v.seats} places
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-slate-500"
              onClick={() => {
                try {
                  upsertVehicle({ ...v, active: !v.active });
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Erreur");
                }
              }}
            >
              {v.active ? "Retirer" : "Réactiver"}
            </button>
          </div>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2">
            <h2 className="h2">Nouveau véhicule</h2>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marque" />
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modèle" />
            <input className="input" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            <input
              className="input"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="Plaque"
              required
            />
            <input
              className="input"
              type="number"
              min={4}
              max={60}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Fermer
              </button>
              <button className="btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
