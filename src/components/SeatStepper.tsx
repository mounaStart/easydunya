type SeatStepperProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
};

/** Boutons − / + lisibles sur téléphone (le champ number natif est souvent bloqué). */
export default function SeatStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled,
}: SeatStepperProps) {
  const lo = Math.max(1, min);
  const hi = Math.max(lo, max);
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-100 px-1 py-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(lo, value - 1))}
        disabled={disabled || value <= lo}
        className="w-9 h-9 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="−"
      >
        −
      </button>
      <span className="min-w-[2.25rem] text-center text-lg font-extrabold text-ink tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(hi, value + 1))}
        disabled={disabled || value >= hi}
        className="w-9 h-9 rounded-lg bg-white text-lg font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}
