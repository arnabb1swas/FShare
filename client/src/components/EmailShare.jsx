import { useState } from "react";
import { sendEmail } from "../lib/api.js";

export default function EmailShare({ slug }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    setError("");

    try {
      await sendEmail({ slug, emailFrom: from, emailTo: to });
      setState("sent");
    } catch (err) {
      setError(err.error || "Failed to send");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
        Email sent
      </p>
    );
  }

  const sending = state === "sending";

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <p className="text-sm font-medium text-soft">Or email the link</p>

      {/* from + to each on their own line so long addresses aren't truncated */}
      <input
        type="email"
        required
        placeholder="Your email"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="field w-full rounded-lg px-3 py-2 text-sm"
      />

      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          placeholder="Recipient email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
        />
        <button
          disabled={sending}
          aria-label="Send email"
          title="Send email"
          className="btn-gradient grid h-9 w-9 shrink-0 place-items-center rounded-lg disabled:opacity-60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-[18px] w-[18px] ${sending ? "animate-pulse" : ""}`}>
            <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
          </svg>
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
