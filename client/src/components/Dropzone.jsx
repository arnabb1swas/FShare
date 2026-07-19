import { useRef, useState } from "react";

export default function Dropzone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function pick(files) {
    if (files && files[0]) {
      onFile(files[0]);
    }
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) {
          pick(e.dataTransfer.files);
        }
      }}
      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300
        ${over
          ? "scale-[1.02] border-indigo-400 bg-indigo-500/10 shadow-[0_0_40px_-8px_rgba(99,102,241,0.6)]"
          : "border-white/40 hover:border-indigo-400/70 hover:bg-white/5"}
        ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files)} />
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg transition-transform duration-300 ${over ? "scale-110" : "group-hover:scale-105"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-8 w-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6m0 0L7.5 10.5M12 6l4.5 4.5M4.5 18h15" />
        </svg>
      </div>
      <p className="text-lg font-semibold">{over ? "Drop it!" : "Drop a file here"}</p>
      <p className="text-sm text-soft">or click to browse</p>
    </div>
  );
}
