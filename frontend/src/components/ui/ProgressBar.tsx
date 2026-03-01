const STEPS = ['Session', 'Details', 'Review', 'Done'];

export default function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / (STEPS.length - 1)) * 100);
  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        {STEPS.map((s, i) => (
          <span key={s} className={`text-xs font-medium ${i <= step ? 'text-teal' : 'text-muted'}`}>{s}</span>
        ))}
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-teal rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
