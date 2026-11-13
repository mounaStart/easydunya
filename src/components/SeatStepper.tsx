import { useEffect, useState } from "react";

type SeatStepperProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

function clampSeats(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Boutons − / + et saisie directe du nombre. */
export default function SeatStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
}: SeatStepperProps) {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const next = clampSeats(n, lo, hi);
    onChange(next);
    setDraft(String(next));
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-100 px-1 py-0.5">
      <button
        type="button"
        onClick={() => onChange(clampSeats(value - 1, lo, hi))}
        disabled={disabled || value <= lo}
        className="w-9 h-9 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="−"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(raw);
          if (raw === "") return;
          const n = Number.parseInt(raw, 10);
          if (Number.isFinite(n) && n >= lo && n <= hi) onChange(n);
        }}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-12 h-9 bg-transparent text-center text-lg font-extrabold text-ink tabular-nums outline-none disabled:opacity-40"
        aria-label="Nombre de places"
      />
      <button
        type="button"
        onClick={() => onChange(clampSeats(value + 1, lo, hi))}
        disabled={disabled || value >= hi}
        className="w-9 h-9 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}
