import { Link } from "react-router-dom";
import { useAgency } from "../../lib/agency/useAgency";
import { freeSeatCount, seatsByChannel, tripDisplayStatus } from "../../lib/agency/rules";
import { CHANNEL_COLOR, CHANNEL_LABEL } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function AgencyDashboard() {
  const { trips, bookings, staff, db } = useAgency();
  const upcoming = trips
    .filter((t) => t.status === "publie" && new Date(t.departAt).getTime() > Date.now())
    .sort((a, b) => a.departAt.localeCompare(b.departAt))
    .slice(0, 6);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const week = Date.now() - 7 * 86400000;
  const weekBookings = bookings.filter((b) => new Date(b.createdAt).getTime() >= week && b.status !== "annulee");
  const pending = bookings.filter((b) => b.status === "attente");
  const sold = bookings.filter((b) => b.status === "confirmee" || b.status === "terminee").reduce((s, b) => s + b.seats, 0);
  const remaining = upcoming.reduce((s, t) => s + freeSeatCount(db, t), 0);
  const published = trips.filter((t) => t.status === "publie" && new Date(t.departAt) > new Date()).length;

  const byCh = { app: 0, guichet: 0, sous: 0 };
  for (const b of weekBookings) {
    if (b.pay === "paye" || b.pay === "rembourse_partiel") {
      byCh[b.channel] += b.pay === "paye" ? b.total : b.total - (b.refund ?? 0);
    } else if (b.status !== "annulee") {
      /* not cash yet */
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Départs publiés" value={String(published)} />
        <Stat label="Réservations" value={String(bookings.length)} />
        <Stat label="Places vendues" value={String(sold)} />
        <Stat label="Places restantes" value={String(remaining)} />
        <Stat label="En attente" value={String(pending.length)} tone="amber" />
      </div>

      <section>
        <h2 className="h2 mb-2">Prochains départs</h2>
        {upcoming.length === 0 ? (
          <p className="muted text-sm">Aucun départ à venir.{staff?.role === "admin" && " Publiez-en un."}</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((t) => {
              const st = tripDisplayStatus(db, t);
              const ch = seatsByChannel(db, t.id);
              return (
                <Link key={t.id} to="/agence/places" className="card p-3 block hover:shadow-sm">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-bold">
                        {t.fromName} → {t.toName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(t.departAt).toLocaleString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {formatPrice(t.price)}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full h-fit ${badge(st)}`}>
                      {label(st)} · {freeSeatCount(db, t)} lib.
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full overflow-hidden flex bg-slate-100">
                    {(["app", "guichet", "sous"] as const).map((c) => (
                      <div
                        key={c}
                        title={`${CHANNEL_LABEL[c]} ${ch[c]}`}
                        style={{
                          width: `${(ch[c] / t.seats) * 100}%`,
                          background: CHANNEL_COLOR[c],
                        }}
                      />
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="h2 mb-2">Ventes 7 jours par canal</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["app", "guichet", "sous"] as const).map((c) => (
            <div key={c} className="card p-3">
              <div className="text-[10px] font-bold uppercase" style={{ color: CHANNEL_COLOR[c] }}>
                {CHANNEL_LABEL[c]}
              </div>
              <div className="font-extrabold">{formatPrice(byCh[c])}</div>
            </div>
          ))}
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="h2 mb-2">Réservations à traiter</h2>
          <Link to="/agence/reservations" className="text-sm font-semibold text-brand-700">
            {pending.length} en attente →
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-xl font-extrabold ${tone === "amber" ? "text-amber-600" : "text-brand-700"}`}>
        {value}
      </div>
    </div>
  );
}

function badge(st: string) {
  if (st === "ouvert") return "bg-emerald-100 text-emerald-800";
  if (st === "presque") return "bg-amber-100 text-amber-800";
  if (st === "complet") return "bg-rose-100 text-rose-800";
  if (st === "annule") return "bg-slate-200 text-slate-600";
  return "bg-slate-100 text-slate-500";
}
function label(st: string) {
  return (
    { ouvert: "Ouvert", presque: "Presque complet", complet: "Complet", termine: "Terminé", annule: "Annulé" }[
      st
    ] ?? st
  );
}
