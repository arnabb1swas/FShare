import { useState } from "react";

export default function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard API unavailable (http / older browsers) → hidden-textarea fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="field flex items-center gap-2 rounded-xl p-1.5">
      <input
        readOnly
        value={url}
        className="min-w-0 flex-1 truncate bg-transparent px-2 text-sm outline-none"
      />
      <button
        onClick={copy}
        aria-label={copied ? "Link copied" : "Copy link"}
        title={copied ? "Copied!" : "Copy link"}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all duration-200 ${
          copied ? "bg-emerald-500 text-white" : "btn-gradient"
        }`}
      >
        {copied ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-[18px] w-[18px]">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
