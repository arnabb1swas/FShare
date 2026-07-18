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

export default function ExpirySelect({ value, onChange }) {
  const [mode, setMode] = useState("preset");
  const maxDate = new Date(Date.now() + 30 * 86_400_000);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Link expires in</label>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() => { setMode("preset"); onChange(isoFromNow(p.hours)); }}
            className={`rounded-full px-3 py-1 text-sm ${
              mode === "preset" && value === isoFromNow(p.hours)
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`rounded-full px-3 py-1 text-sm ${mode === "custom" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          Custom
        </button>
      </div>
      {mode === "custom" && (
        <input
          type="datetime-local"
          max={toLocalInput(maxDate)}
          min={toLocalInput(new Date())}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        />
      )}
    </div>
  );
}
