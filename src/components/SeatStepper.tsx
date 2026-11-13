import { useEffect, useRef, useState } from "react";

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
  const focusedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
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
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
          requestAnimationFrame(() => inputRef.current?.select());
        }}
        onChange={(e) => {
          setDraft(e.target.value.replace(/\D/g, "").slice(0, 2));
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          }
        }}
        className="w-12 h-9 rounded-lg bg-white text-center text-lg font-extrabold text-ink tabular-nums outline-none ring-1 ring-slate-200 focus:ring-brand-400 disabled:opacity-40"
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
