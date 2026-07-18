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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">FShare</h1>
        <p className="text-gray-500">Share any file with a clean, expiring link.</p>
      </header>

      {state === "idle" && (
        <div className="space-y-4">
          <Dropzone onFile={onFile} />
          <ExpirySelect value={expires} onChange={setExpires} />
        </div>
      )}

      {state === "uploading" && (
        <div className="space-y-3">
          <p className="text-center text-sm text-gray-600">Uploading… {pct}%</p>
          <ProgressBar pct={pct} />
        </div>
      )}

      {state === "success" && result && (
        <div className="space-y-4 rounded-2xl border border-gray-200 p-6">
          <div>
            <p className="font-medium text-gray-900">{result.name}</p>
            <p className="text-sm text-gray-500">{formatSize(result.size)}</p>
          </div>
          <CopyLink url={result.file} />
          <EmailShare slug={result.slug} />
          <button onClick={reset} className="text-sm text-blue-600 hover:underline">Share another file</button>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-3 text-center">
          <p className="text-red-600">{error}</p>
          <button onClick={reset} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Try again</button>
        </div>
      )}
    </main>
  );
}
