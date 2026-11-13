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

/** Si on tape 5 alors que 8 est encore là → « 85 » : on garde seulement le 5. */
export function nextSeatDraft(previous: string, incoming: string, replace: boolean): string {
  const digits = incoming.replace(/\D/g, "").slice(0, 2);
  if (!replace) return digits;
  const prev = previous.replace(/\D/g, "");
  if (digits === "") return "";
  if (prev && digits.startsWith(prev) && digits.length > prev.length) {
    return digits.slice(prev.length).slice(0, 2);
  }
  return digits;
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
  const draftRef = useRef(draft);
  const focusedRef = useRef(false);
  const replaceRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  draftRef.current = draft;

  useEffect(() => {
    if (!focusedRef.current) {
      const next = String(value);
      setDraft(next);
      draftRef.current = next;
    }
  }, [value]);

  function commit(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      const fallback = String(value);
      setDraft(fallback);
      draftRef.current = fallback;
      return;
    }
    const next = clampSeats(n, lo, hi);
    onChange(next);
    const shown = String(next);
    setDraft(shown);
    draftRef.current = shown;
  }

  function setDraftBoth(next: string) {
    draftRef.current = next;
    setDraft(next);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(clampSeats(value - 1, lo, hi))}
        disabled={disabled || value <= lo}
        className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-xl font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="−"
      >
        −
      </button>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        value={draft}
        onFocus={() => {
          focusedRef.current = true;
          replaceRef.current = true;
        }}
        onMouseUp={(e) => {
          e.preventDefault();
          inputRef.current?.select();
        }}
        onChange={(e) => {
          const next = nextSeatDraft(draftRef.current, e.target.value, replaceRef.current);
          replaceRef.current = false;
          setDraftBoth(next);
        }}
        onBlur={() => {
          focusedRef.current = false;
          replaceRef.current = false;
          commit(draftRef.current);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          }
        }}
        className="input w-20 text-center text-lg font-extrabold tabular-nums"
        aria-label="Nombre de places"
      />
      <button
        type="button"
        onClick={() => onChange(clampSeats(value + 1, lo, hi))}
        disabled={disabled || value >= hi}
        className="w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200 text-xl font-bold text-ink-soft active:scale-95 transition disabled:opacity-40"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}
