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

  if (state === "sent") return <p className="text-sm text-green-600">Email sent ✓</p>;

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Or email the link</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" required placeholder="Your email" value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <input type="email" required placeholder="Recipient email" value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <button disabled={state === "sending"}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60">
          {state === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
