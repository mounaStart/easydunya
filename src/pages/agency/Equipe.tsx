import { useState, type FormEvent } from "react";
import { useAgency } from "../../lib/agency/useAgency";
import { upsertStaff } from "../../lib/agency/store";
import { PERM_PRESETS } from "../../lib/agency/types";

export default function AgencyEquipe() {
  const { staffAll } = useAgency();
  const [sOpen, setSOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [display, setDisplay] = useState("");
  const [preset, setPreset] = useState<keyof typeof PERM_PRESETS>("guichet_complet");
  const [pass, setPass] = useState("demo1234");
  const [err, setErr] = useState<string | null>(null);

  function addS(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      upsertStaff({
        name: display,
        login,
        email: `${login.trim().toLowerCase()}@agence.local`,
        password: pass,
        role: "agent",
        pointId: "principal",
        perms: PERM_PRESETS[preset].perms,
        active: true,
      });
      setSOpen(false);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="flex justify-between mb-2">
          <h2 className="h2">Mon équipe</h2>
          <button type="button" className="btn-primary text-sm" onClick={() => setSOpen(true)}>
            Inviter
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Version petites agences : un seul guichet, pas de sous-agence.</p>
        {staffAll.map((s) => (
          <div key={s.id} className="card p-3 mb-2 flex justify-between">
            <div>
              <div className="font-bold">
                {s.name} <span className="text-xs font-normal text-slate-400">@{s.login}</span>
              </div>
              <div className="text-xs text-slate-500">
                {s.role === "admin" ? "Propriétaire" : "Employé"} · {s.perms.join(", ")}
              </div>
            </div>
            {s.role !== "admin" && (
              <button
                type="button"
                className="text-xs"
                onClick={() => {
                  if (!confirm(s.active ? "Désactiver ce compte ?" : "Réactiver ce compte ?")) return;
                  upsertStaff({
                    id: s.id,
                    name: s.name,
                    login: s.login,
                    email: s.email,
                    role: s.role,
                    pointId: "principal",
                    perms: s.perms,
                    active: !s.active,
                  });
                }}
              >
                {s.active ? "Désactiver" : "Activer"}
              </button>
            )}
          </div>
        ))}
      </section>
      {sOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={addS} className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2">
            <h2 className="h2">Inviter un employé</h2>
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant" required />
            <input className="input" value={display} onChange={(e) => setDisplay(e.target.value)} placeholder="Nom affiché" required />
            <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
            <select className="input" value={preset} onChange={(e) => setPreset(e.target.value as typeof preset)}>
              {(Object.keys(PERM_PRESETS) as Array<keyof typeof PERM_PRESETS>).map((k) => (
                <option key={k} value={k}>{PERM_PRESETS[k].label}</option>
              ))}
            </select>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setSOpen(false)}>Fermer</button>
              <button className="btn-primary">Inviter</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
