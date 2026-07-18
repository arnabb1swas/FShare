import { useRef, useState } from "react";

export default function Dropzone({ onFile, disabled }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  function pick(files) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files); }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition
        ${over ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}
        ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files)} />
      <p className="text-lg font-medium text-gray-700">Drop a file here</p>
      <p className="text-sm text-gray-500">or click to browse</p>
    </div>
  );
}
