import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getFileMeta } from "../lib/api.js";
import { formatSize, formatCountdown } from "../lib/format.js";

export default function Download() {
  const { slug } = useParams();
  const [state, setState] = useState("loading");
  const [meta, setMeta] = useState(null);
  const [, tick] = useState(0);

  useEffect(() => {
    getFileMeta(slug)
      .then((m) => { setMeta(m); setState("ready"); })
      .catch((err) => setState(err.status === 410 ? "expired" : err.status === 404 ? "notfound" : "error"));
  }, [slug]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <Link to="/" className="text-3xl font-extrabold tracking-tight gradient-text">FShare</Link>

      {state === "loading" && <p className="text-soft">Loading…</p>}

      {state === "ready" && meta && (
        <div className="glass pop-in w-full space-y-5 rounded-3xl p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" className="h-8 w-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Your file is ready</h2>
            <p className="mt-2 truncate font-medium">{meta.filename}</p>
            <p className="text-sm text-soft">{formatSize(meta.size)} ・ {formatCountdown(meta.expiresAt)}</p>
          </div>
          <a href={meta.downloadLink}
            className="btn-gradient inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download file
          </a>
        </div>
      )}

      {(state === "expired" || state === "notfound") && (
        <div className="glass pop-in w-full space-y-3 rounded-3xl p-8">
          <p className="text-red-400">{state === "expired" ? "This link has expired." : "Link not found."}</p>
          <Link to="/" className="text-sm font-medium text-soft transition-colors hover:text-indigo-400">Share a file instead →</Link>
        </div>
      )}

      {state === "error" && <p className="text-red-400">Something went wrong.</p>}
    </main>
  );
}
