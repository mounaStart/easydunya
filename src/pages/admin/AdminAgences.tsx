import { useEffect, useState, type FormEvent } from "react";
import {
  createAgencyByEasyDunya,
  getAgencyDb,
  hydrateAgencyCloud,
  resetAgencyDemo,
  setAgencyStatus,
  subscribeAgency,
} from "../../lib/agency/store";

export default function AdminAgences() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAgency(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    void hydrateAgencyCloud();
  }, []);
  const db = getAgencyDb();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Nouakchott");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; login: string; password: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreated(null);
    setBusy(true);
    try {
      const r = await createAgencyByEasyDunya({
        name,
        address,
        city,
        email,
        login,
        adminName,
        password,
        phone,
      });
      if (r.error) setErr(r.error);
      else {
        setCreated({
          name: r.agency?.name ?? name,
          login: r.login ?? login.trim().toLowerCase(),
          password,
        });
        setName("");
        setLogin("");
        setAdminName("");
        setEmail("");
        setPhone("");
        setAddress("");
        setPassword("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void submit(e)} className="space-y-3 max-w-md">
        <div>
          <h3 className="font-bold text-lg">Créer une agence</h3>
          <p className="text-xs text-slate-500 mt-1">
            L’agence est active tout de suite. Donnez l’identifiant et le mot de passe au propriétaire : il se
            connecte sur la page Connexion.
          </p>
        </div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'agence" required />
        <input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Nom du propriétaire" required />
        <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Identifiant de connexion (ex. sahel2)" required />
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required />
        <input
          className="input"
          inputMode="numeric"
          maxLength={8}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Téléphone 8 chiffres"
        />
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse / gare" required />
        <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville" />
        <input
          className="input"
          type="text"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe (6 caractères min.)"
          required
          minLength={6}
        />
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {created && (
          <div className="rounded-xl bg-emerald-50 text-emerald-900 text-sm p-3 space-y-1">
            <p className="font-bold">Agence {created.name} créée et activée.</p>
            <p>
              Identifiant : <strong>{created.login}</strong>
            </p>
            <p>
              Mot de passe : <strong>{created.password}</strong>
            </p>
            <p className="text-xs">Le propriétaire se connecte avec cet identifiant (pas un numéro de téléphone).</p>
          </div>
        )}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Création…" : "Créer l'agence"}
        </button>
      </form>

      <section>
        <h3 className="font-bold mb-2">Agences</h3>
        <div className="space-y-2">
          {db.agencies.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-xl p-3">
              <div>
                <div className="font-bold">{a.name}</div>
                <div className="text-xs text-slate-500">
                  {a.slug} · {a.city} · {a.status}
                  {a.phone ? ` · ${a.phone}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {a.status !== "approved" && (
                  <button type="button" className="btn-primary text-xs" onClick={() => setAgencyStatus(a.id, "approved")}>
                    Approuver
                  </button>
                )}
                {a.status !== "suspended" && (
                  <button type="button" className="btn-ghost text-xs text-rose-700" onClick={() => setAgencyStatus(a.id, "suspended")}>
                    Suspendre
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Comptes d’essai déjà présents : sahel, sahel.guichet, amal, tagant — mot de passe demo1234.
      </p>
      <button
        type="button"
        className="btn-ghost text-xs text-slate-500"
        onClick={() => {
          if (confirm("Réinitialiser seulement ce navigateur (les agences déjà enregistrées restent) ?")) {
            resetAgencyDemo();
            void hydrateAgencyCloud();
          }
        }}
      >
        Recharger les données partagées
      </button>
    </div>
  );
}
