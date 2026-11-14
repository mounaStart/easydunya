import { occupiedSeatNos } from "../../lib/agency/rules";
import type { AgencyBooking, AgencyChannel, AgencyDB, AgencyTrip } from "../../lib/agency/types";
import { CHANNEL_COLOR } from "../../lib/agency/types";

function seatOwner(bookings: AgencyBooking[], n: number): AgencyBooking | undefined {
  return bookings.find(
    (b) =>
      b.seatNos.includes(n) &&
      (b.status === "attente" || b.status === "confirmee" || b.status === "terminee")
  );
}

export default function SeatMap({
  db,
  trip,
  selected,
  onToggle,
  interactive,
}: {
  db: AgencyDB;
  trip: AgencyTrip;
  selected?: number[];
  onToggle?: (n: number) => void;
  interactive?: boolean;
}) {
  const bookings = db.bookings.filter((b) => b.tripId === trip.id);
  const taken = new Set(occupiedSeatNos(db, trip.id));
  const sel = new Set(selected ?? []);
  const cols = 4;
  const rows = Math.ceil(trip.seats / cols);

  return (
    <div>
      <div className="text-center text-[10px] uppercase tracking-wide text-slate-400 mb-2">Avant</div>
      <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: "repeat(5, 2rem)" }}>
        {Array.from({ length: rows }).map((_, r) => {
          const left = [r * cols + 1, r * cols + 2].filter((n) => n <= trip.seats);
          const right = [r * cols + 3, r * cols + 4].filter((n) => n <= trip.seats);
          return [
            ...left.map((n) => renderSeat(n)),
            <div key={`aisle-${r}`} className="w-4" />,
            ...right.map((n) => renderSeat(n)),
          ];
        })}
      </div>
    </div>
  );

  function renderSeat(n: number) {
    const b = seatOwner(bookings, n);
    const pending = b?.status === "attente";
    const ch: AgencyChannel | null = b?.channel ?? null;
    const isSel = sel.has(n);
    const isTaken = taken.has(n) && !isSel;
    const bg = isSel
      ? "#1976D2"
      : ch
        ? CHANNEL_COLOR[ch]
        : "#fff";
    return (
      <button
        key={n}
        type="button"
        disabled={!interactive || isTaken}
        onClick={() => onToggle?.(n)}
        className="w-8 h-8 rounded-md text-[10px] font-bold border"
        style={{
          background: bg,
          color: isSel || ch ? "#fff" : "#334155",
          borderColor: isSel ? "#1565C0" : "#cbd5e1",
          backgroundImage: pending
            ? "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.35) 3px, rgba(255,255,255,.35) 6px)"
            : undefined,
          opacity: isTaken && !isSel ? 0.95 : 1,
        }}
        title={`Place ${n}`}
      >
        {n}
      </button>
    );
  }
}
