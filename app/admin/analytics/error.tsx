'use client'

export default function AdminAnalyticsError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-body text-sm text-charcoal/60 mb-4">
        Couldn&apos;t load platform analytics. Try refreshing.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center h-9 px-5 rounded-lg border border-charcoal/20 text-charcoal font-subhead font-semibold text-sm hover:border-charcoal/40 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
