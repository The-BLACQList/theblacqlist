export default function SearchAnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-3 w-20 rounded bg-charcoal/6" />
        <div className="h-7 w-48 rounded-lg bg-charcoal/8" />
        <div className="h-4 w-72 rounded bg-charcoal/6" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 w-10 rounded bg-charcoal/6" />
            <div className="h-9 w-28 rounded-lg bg-charcoal/8" />
          </div>
        ))}
      </div>

      {/* Table skeletons */}
      {[...Array(2)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-3.5 w-48 rounded bg-charcoal/6" />
            <div className="h-3.5 w-8 rounded bg-charcoal/6" />
          </div>
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            <div className="h-10 bg-[#f9f9fb] border-b border-charcoal/10" />
            {[...Array(8)].map((_, j) => (
              <div key={j} className="px-4 py-3 border-b border-charcoal/5 flex gap-4">
                <div className="h-4 w-4 rounded bg-charcoal/8" />
                <div className="h-4 flex-1 rounded bg-charcoal/8" />
                <div className="h-4 w-10 rounded bg-charcoal/8" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
