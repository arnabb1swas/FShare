import { useState } from "react";
import Dropzone from "../components/Dropzone.jsx";
import ExpirySelect from "../components/ExpirySelect.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import CopyLink from "../components/CopyLink.jsx";
import EmailShare from "../components/EmailShare.jsx";
import { uploadFile } from "../lib/api.js";
import { formatSize } from "../lib/format.js";

const MAX_MB = 100; // mirrors server MAX_FILE_MB default

export default function Upload() {
  const [state, setState] = useState("idle");
  const [pct, setPct] = useState(0);
  const [expires, setExpires] = useState(""); // "" = server default 24h
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function onFile(file) {
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_MB} MB)`); setState("error"); return;
    }
    setState("uploading"); setPct(0); setError("");
    try {
      const res = await uploadFile(file, expires, setPct);
      setResult({ ...res, name: file.name, size: file.size });
      setState("success");
    } catch (err) {
      setError(err.error || "Upload failed"); setState("error");
    }
  }

  function reset() { setState("idle"); setResult(null); setError(""); setPct(0); }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 p-6">
      <header className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">
          <span className="gradient-text">FShare</span>
        </h1>
        <p className="mt-2 text-soft">Share any file with a clean, expiring link.</p>
      </header>

      <div className="glass pop-in rounded-3xl p-6 sm:p-8">
        {state === "idle" && (
          <div className="space-y-6">
            <Dropzone onFile={onFile} />
            <ExpirySelect value={expires} onChange={setExpires} />
          </div>
        )}

        {state === "uploading" && (
          <div className="space-y-4 py-4">
            <p className="text-center text-sm text-soft">Uploading… <span className="font-semibold gradient-text">{pct}%</span></p>
            <ProgressBar pct={pct} />
          </div>
        )}

        {state === "success" && result && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.25 11.25-3-3m0 0-3 3m3-3v6" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{result.name}</p>
                <p className="text-sm text-soft">{formatSize(result.size)}</p>
              </div>
            </div>
            <CopyLink url={result.file} />
            <EmailShare slug={result.slug} />
            <button onClick={reset} className="text-sm font-medium text-soft transition-colors hover:text-indigo-400">
              ← Share another file
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4 py-4 text-center">
            <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-red-400">{error}</p>
            <button onClick={reset} className="btn-gradient rounded-lg px-5 py-2.5 text-sm font-semibold">Try again</button>
          </div>
        )}
      </div>
    </main>
  );
}
