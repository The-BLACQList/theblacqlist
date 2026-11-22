import Link from 'next/link'
import { CheckCircle2, ChevronRight, Circle } from 'lucide-react'
import type { ChecklistItem } from '@/lib/dashboard/home'

// The page checklist (ticket 253): progress, and the one next step as the
// button. The full list sits behind See All Steps. Hidden once complete.
export function FinishYourPage({ pageId, items }: { pageId: string; items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length
  const next = items.find((i) => !i.done)
  if (!next) return null
  const pct = Math.round((done / items.length) * 100)
  return (
    <section
      aria-labelledby="finish-heading"
      data-testid="home-finish"
      className="rounded-2xl border border-charcoal/10 bg-white px-5 py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="finish-heading" className="font-headline text-lg text-brand-black">
          Finish Your Page
        </h2>
        <p className="font-subhead text-sm text-charcoal-soft">
          {done} of {items.length} Done
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Page progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        className="mt-3 h-2 overflow-hidden rounded-full bg-charcoal/10"
      >
        <div className="h-full rounded-full bg-amber" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-body text-sm text-charcoal">
          <span className="text-charcoal-soft">Next: </span>
          <span className="font-semibold text-brand-black">{next.label}</span>
        </p>
        <Link
          href={`/dashboard/pages/${pageId}/edit`}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-brand-black px-5 font-subhead text-sm font-semibold text-white transition-colors hover:bg-charcoal"
        >
          {next.label} <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <details className="group mt-4">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-subhead text-sm font-semibold text-amber hover:underline">
          See All Steps
        </summary>
        <ul className="mt-1 space-y-2">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 font-body text-sm">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-amber" aria-hidden="true" />
              ) : (
                <Circle className="size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
              )}
              <span className={item.done ? 'text-charcoal-soft line-through' : 'text-charcoal'}>
                {item.label}
              </span>
              <span className="sr-only">{item.done ? '(done)' : '(to do)'}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}
