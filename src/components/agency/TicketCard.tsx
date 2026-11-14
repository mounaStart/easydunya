import type { Agency, AgencyBooking, AgencyTrip } from "../../lib/agency/types";
import { formatPrice } from "../../lib/utils";

export default function TicketCard({
  agency,
  trip,
  booking,
  compact,
}: {
  agency: Agency;
  trip: AgencyTrip;
  booking: AgencyBooking;
  compact?: boolean;
}) {
  const when = new Date(trip.departAt);
  const payLabel = booking.pay === "paye" ? "Payé" : booking.pay === "a_payer" ? "À payer" : booking.pay;
  const text = [
    `Easy Dunya · ${agency.name}`,
    `${trip.fromName} → ${trip.toName}`,
    when.toLocaleString("fr-FR"),
    `${booking.passenger} · ${booking.phone}`,
    `Places ${booking.seatNos.join(", ")} · ${formatPrice(booking.total)}`,
    `Code ${booking.code} · ${payLabel}`,
    trip.meeting,
  ].join("\n");

  function share() {
    const url = `https://wa.me/222${booking.phone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
  }

  return (
    <div className="card overflow-hidden border-brand-100">
      <div className="px-4 py-3 text-white" style={{ backgroundImage: "var(--brand-gradient)" }}>
        <div className="text-xs opacity-90">{agency.name}</div>
        <div className="font-extrabold text-lg">
          {trip.fromName} → {trip.toName}
        </div>
        <div className="text-sm opacity-90">
          {when.toLocaleDateString("fr-FR")} ·{" "}
          {when.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
      <div className="p-4 grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="text-sm space-y-1">
          <div className="font-bold">{booking.passenger}</div>
          <div className="text-slate-500">+222 {booking.phone}</div>
          <div>Places {booking.seatNos.join(", ")}</div>
          <div className="font-extrabold text-brand-700">{formatPrice(booking.total)}</div>
          <div className="text-xs text-slate-500">{trip.meeting}</div>
          <span
            className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${
              booking.pay === "paye" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {payLabel}
          </span>
        </div>
        <div className="text-center">
          <div className="w-24 h-24 bg-slate-900 text-white text-[9px] font-mono p-1 leading-tight break-all flex items-center justify-center">
            QR {booking.code}
          </div>
          <div className="mt-1 font-mono text-xs font-bold">{booking.code}</div>
        </div>
      </div>
      {!compact && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-xs" onClick={() => void copy()}>
            Copier
          </button>
          <button type="button" className="btn-primary text-xs" onClick={share}>
            WhatsApp
          </button>
          <button type="button" className="btn-ghost text-xs" onClick={() => window.print()}>
            Reçu
          </button>
        </div>
      )}
    </div>
  );
}
