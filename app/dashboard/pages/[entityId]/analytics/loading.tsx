export default function AnalyticsLoading() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-7 w-28 rounded-lg bg-charcoal/8" />
          <div className="h-4 w-40 rounded bg-charcoal/6" />
        </div>
        <div className="h-8 w-32 rounded-lg bg-charcoal/8" />
      </div>

      {/* All-time cards */}
      <div>
        <div className="h-3.5 w-16 rounded bg-charcoal/6 mb-3" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-charcoal/10 bg-white px-5 py-4 space-y-2">
              <div className="h-3 w-16 rounded bg-charcoal/8" />
              <div className="h-7 w-12 rounded bg-charcoal/8" />
            </div>
          ))}
        </div>
      </div>

      {/* Period cards */}
      <div>
        <div className="h-3.5 w-24 rounded bg-charcoal/6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-charcoal/10 bg-white px-5 py-4 space-y-2">
              <div className="h-3 w-16 rounded bg-charcoal/8" />
              <div className="h-7 w-10 rounded bg-charcoal/8" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeletons */}
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="h-3.5 w-32 rounded bg-charcoal/6 mb-2" />
          <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
            <div className="flex items-end gap-0.5 w-full" style={{ height: 80 }}>
              {[...Array(20)].map((_, j) => (
                <div
                  key={j}
                  className="flex-1 rounded-t-sm bg-charcoal/8"
                  style={{ height: `${20 + Math.random() * 60}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
