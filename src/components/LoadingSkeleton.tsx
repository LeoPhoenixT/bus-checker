export function StopCardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/5 rounded-md bg-[var(--divider)]" />
          <div className="h-3 w-2/5 rounded bg-[var(--divider)]" />
        </div>
        <div className="h-6 w-16 rounded-full bg-[var(--divider)]" />
      </div>
      <div className="space-y-0 divide-y divide-[var(--divider)]">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="h-5 w-16 rounded-lg bg-[var(--divider)]" />
            <div className="flex-1 h-4 rounded bg-[var(--divider)]" />
            <div className="h-5 w-14 rounded-full bg-[var(--divider)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
