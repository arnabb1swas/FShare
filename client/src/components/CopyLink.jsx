import { useState } from "react";

export default function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-2">
      <input readOnly value={url} className="flex-1 bg-transparent px-2 text-sm text-gray-700 outline-none" />
      <button onClick={copy} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
