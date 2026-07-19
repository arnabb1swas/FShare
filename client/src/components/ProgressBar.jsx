export default function ProgressBar({ pct }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/30 bg-white/10">
      <div className="shimmer h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}
