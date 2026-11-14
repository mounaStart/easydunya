import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAgency } from "../../lib/agency/useAgency";
import { hasPerm } from "../../lib/agency/rules";
import { logoutAgency } from "../../lib/agency/store";
import { cn } from "../../lib/utils";

const ALL_LINKS: Array<{
  to: string;
  label: string;
  perm: "reservations" | "vendre" | "embarquement" | "rapports" | null;
  end: boolean;
  adminOnly: boolean;
}> = [
  { to: "/agence", label: "Tableau", perm: null, end: true, adminOnly: false },
  { to: "/agence/departs", label: "Départs", perm: null, end: false, adminOnly: true },
  { to: "/agence/places", label: "Places", perm: "reservations", end: false, adminOnly: false },
  { to: "/agence/reservations", label: "Réservations", perm: "reservations", end: false, adminOnly: false },
  { to: "/agence/guichet", label: "Guichet", perm: "vendre", end: false, adminOnly: false },
  { to: "/agence/embarquement", label: "Embarquement", perm: "embarquement", end: false, adminOnly: false },
  { to: "/agence/rapports", label: "Rapports", perm: "rapports", end: false, adminOnly: false },
  { to: "/agence/vehicules", label: "Véhicules", perm: null, end: false, adminOnly: true },
  { to: "/agence/chauffeurs", label: "Chauffeurs", perm: null, end: false, adminOnly: true },
  { to: "/agence/reseau", label: "Réseau", perm: null, end: false, adminOnly: true },
  { to: "/agence/parametres", label: "Paramètres", perm: null, end: false, adminOnly: true },
];

export default function AgencyLayout() {
  const { staff, agency } = useAgency();
  const location = useLocation();
  const navigate = useNavigate();
  if (!staff || !agency) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (agency.status !== "approved") {
    return (
      <div className="page max-w-lg">
        <div className="card p-6 text-center">Agence non active.</div>
      </div>
    );
  }

  const links = ALL_LINKS.filter((l) => {
    if (l.adminOnly && staff.role !== "admin") return false;
    if (l.perm && !hasPerm(staff, l.perm)) return false;
    return true;
  });

  const mobile = staff.role === "admin"
    ? [
        { to: "/agence", label: "Accueil", end: true },
        { to: "/agence/departs", label: "Départs", end: false },
        { to: "/agence/reservations", label: "Réservations", end: false },
        { to: "/agence/guichet", label: "Plus", end: false },
      ]
    : [
        { to: "/agence", label: "Accueil", end: true },
        ...(hasPerm(staff, "vendre") ? [{ to: "/agence/guichet", label: "Vendre", end: false }] : []),
        ...(hasPerm(staff, "reservations")
          ? [{ to: "/agence/reservations", label: "Réservations", end: false }]
          : []),
        ...(hasPerm(staff, "embarquement")
          ? [{ to: "/agence/embarquement", label: "Embarq.", end: false }]
          : []),
      ];

  return (
    <div className="page max-w-5xl pb-20 md:pb-8">
      <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Espace agence</div>
          <h1 className="h1">{agency.name}</h1>
          <p className="muted text-sm">
            {staff.name} · {staff.role === "admin" ? "Administrateur" : "Agent"} ·{" "}
            {staff.pointId === "principal" ? "Guichet principal" : "Sous-agence"}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost text-sm text-rose-700"
          onClick={() => {
            logoutAgency();
            navigate("/login", { replace: true, state: {} });
          }}
        >
          Déconnexion
        </button>
      </div>
      <nav className="hidden md:flex gap-1 overflow-x-auto mb-5 pb-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap",
                isActive ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mobile.length}, minmax(0,1fr))` }}>
          {mobile.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                cn(
                  "py-2 text-[10px] font-semibold text-center",
                  isActive ? "text-brand-600" : "text-slate-400"
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
