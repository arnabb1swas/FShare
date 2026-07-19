import { useState } from "react";

const PRESETS = [
  { label: "1 hour", hours: 1 },
  { label: "1 day", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
];

function isoFromNow(hours) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

// datetime-local needs "YYYY-MM-DDTHH:mm" in local time
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const CHIP = "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200";
const ACTIVE = "btn-gradient";
const IDLE = "glass text-soft hover:-translate-y-0.5";

export default function ExpirySelect({ value, onChange }) {
  // track selection by identity (preset hours | "custom"), not by comparing timestamps
  const [sel, setSel] = useState(null);
  const maxDate = new Date(Date.now() + 30 * 86_400_000);

  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-medium text-soft">Link expires in</label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() =>
              sel === p.hours
                ? (setSel(null), onChange("")) // toggle off → server default
                : (setSel(p.hours), onChange(isoFromNow(p.hours)))
            }
            className={`${CHIP} ${sel === p.hours ? ACTIVE : IDLE}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => (sel === "custom" ? setSel(null) : setSel("custom"), onChange(""))}
          className={`${CHIP} ${sel === "custom" ? ACTIVE : IDLE}`}
        >
          Custom
        </button>
      </div>
      {sel === "custom" && (
        <input
          type="datetime-local"
          max={toLocalInput(maxDate)}
          min={toLocalInput(new Date())}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className="field rounded-lg px-3 py-1.5 text-sm [color-scheme:light] dark:[color-scheme:dark]"
        />
      )}
    </div>
  );
}
