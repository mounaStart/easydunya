import { useState } from "react";
import AdminDrivers from "./AdminDrivers";
import AdminUsers from "./AdminUsers";
import AdminTrips from "./AdminTrips";

type TabId = "drivers" | "users" | "trips";

interface Props {
  onChange?: () => void;
}

export default function AdminTabs({ onChange }: Props) {
  const [tab, setTab] = useState<TabId>("drivers");

  const tabs: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "drivers", label: "Chauffeurs", icon: "🚗" },
    { id: "trips", label: "Voyages", icon: "🛣" },
    { id: "users", label: "Utilisateurs", icon: "👥" },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex border-b border-slate-100 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
              tab === t.id
                ? "border-brand-600 text-brand-700 bg-brand-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {tab === "drivers" && <AdminDrivers onMutate={onChange} />}
        {tab === "trips" && <AdminTrips />}
        {tab === "users" && <AdminUsers />}
      </div>
    </div>
  );
}
