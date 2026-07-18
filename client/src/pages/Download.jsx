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
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Link to="/" className="text-2xl font-bold text-gray-900">FShare</Link>

      {state === "loading" && <p className="text-gray-500">Loading…</p>}

      {state === "ready" && meta && (
        <div className="w-full space-y-4 rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900">Your file is ready</h2>
          <div>
            <p className="font-medium text-gray-800">{meta.filename}</p>
            <p className="text-sm text-gray-500">{formatSize(meta.size)} ・ {formatCountdown(meta.expiresAt)}</p>
          </div>
          <a href={meta.downloadLink}
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">
            Download file
          </a>
        </div>
      )}

      {(state === "expired" || state === "notfound") && (
        <div className="space-y-2">
          <p className="text-red-600">{state === "expired" ? "This link has expired." : "Link not found."}</p>
          <Link to="/" className="text-sm text-blue-600 hover:underline">Share a file instead</Link>
        </div>
      )}

      {state === "error" && <p className="text-red-600">Something went wrong.</p>}
    </main>
  );
}
