import { KEYPAD_KEYS } from "@/lib/constants";

export function KeypadGrid({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="keypad-grid">
      {KEYPAD_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={`keypad-key${k === "C" || k === "⌫" ? " keypad-key-alt" : ""}`}
          onClick={() => onKey(k)}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
