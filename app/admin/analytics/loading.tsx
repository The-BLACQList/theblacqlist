export default function AdminAnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-1">
        <div className="h-7 w-28 rounded-lg bg-charcoal/8" />
        <div className="h-4 w-56 rounded bg-charcoal/6" />
      </div>

      {/* Stat cards skeleton */}
      <div>
        <div className="h-3.5 w-28 rounded bg-charcoal/6 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-charcoal/10 bg-white px-5 py-4 space-y-2">
              <div className="h-3 w-20 rounded bg-charcoal/8" />
              <div className="h-7 w-14 rounded bg-charcoal/8" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div>
        <div className="h-3.5 w-48 rounded bg-charcoal/6 mb-3" />
        <div className="rounded-xl border border-charcoal/10 bg-white px-5 py-5">
          <div className="flex items-end gap-1 w-full" style={{ height: 56 }}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm bg-charcoal/8"
                style={{ height: `${30 + (i % 3) * 20}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Table skeletons */}
      {[...Array(2)].map((_, i) => (
        <div key={i}>
          <div className="h-3.5 w-40 rounded bg-charcoal/6 mb-3" />
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            <div className="h-10 bg-[#f9f9fb] border-b border-charcoal/10" />
            {[...Array(5)].map((_, j) => (
              <div key={j} className="px-4 py-3 border-b border-charcoal/5 flex gap-4">
                <div className="h-4 w-4 rounded bg-charcoal/8" />
                <div className="h-4 flex-1 rounded bg-charcoal/8" />
                <div className="h-4 w-12 rounded bg-charcoal/8" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
