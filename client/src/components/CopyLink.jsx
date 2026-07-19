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
    <div className="field flex items-center gap-2 rounded-xl p-1.5">
      <input readOnly value={url} className="flex-1 truncate bg-transparent px-2 text-sm outline-none" />
      <button
        onClick={copy}
        className={`min-w-[84px] rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
          copied ? "bg-emerald-500 text-white" : "btn-gradient"}`}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
