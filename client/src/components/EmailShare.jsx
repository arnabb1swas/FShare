import { useState } from "react";
import { sendEmail } from "../lib/api.js";

export default function EmailShare({ slug }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending"); setError("");
    try {
      await sendEmail({ slug, emailFrom: from, emailTo: to });
      setState("sent");
    } catch (err) {
      setError(err.error || "Failed to send"); setState("error");
    }
  }

  if (state === "sent")
    return (
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-500">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
        Email sent
      </p>
    );

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <p className="text-sm font-medium text-soft">Or email the link</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" required placeholder="Your email" value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" />
        <input type="email" required placeholder="Recipient email" value={to}
          onChange={(e) => setTo(e.target.value)}
          className="field min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" />
        <button disabled={state === "sending"}
          className="btn-gradient rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
