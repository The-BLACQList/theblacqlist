import Link from 'next/link'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import type { NeedsYouItem } from '@/lib/dashboard/home'

// What is waiting on the owner right now (ticket 253). Only real work shows;
// nothing waiting reads as a calm "all caught up", never a row of zeros.
export function NeedsYou({ items }: { items: NeedsYouItem[] }) {
  return (
    <section
      aria-labelledby="needs-you-heading"
      data-testid="home-needs-you"
      className="rounded-2xl border border-charcoal/10 bg-white"
    >
      <h2
        id="needs-you-heading"
        className="border-b border-charcoal/8 px-5 py-4 font-headline text-lg text-brand-black"
      >
        Needs You
      </h2>
      {items.length === 0 ? (
        <div className="flex items-start gap-3 px-5 py-5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-amber" aria-hidden="true" />
          <div>
            <p className="font-subhead text-base font-semibold text-brand-black">
              You&apos;re All Caught Up
            </p>
            <p className="mt-0.5 font-body text-sm text-charcoal-soft">
              No messages, reviews or receipts are waiting on you.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-charcoal/8">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                data-testid={`needs-you-${item.key}`}
                className="flex min-h-[64px] items-center gap-4 px-5 py-4 transition-colors hover:bg-off-white focus-visible:bg-off-white focus-visible:outline-none"
              >
                {item.count !== undefined ? (
                  <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-brand-black px-2 font-headline text-base text-gold">
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-black"
                  >
                    <span className="size-2 rounded-full bg-gold" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-subhead text-base font-semibold text-brand-black">
                    {item.label}
                  </span>
                  <span className="block font-body text-sm text-charcoal-soft">{item.detail}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-charcoal-soft" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
