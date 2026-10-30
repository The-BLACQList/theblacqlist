'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

const ctaClass =
  'inline-flex min-h-[44px] items-center rounded-full bg-amber-gold px-5 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
const secondaryCtaClass =
  'inline-flex min-h-[44px] items-center rounded-full border border-amber-gold px-5 font-subhead text-sm font-semibold text-amber transition-colors hover:bg-amber-gold hover:text-brand-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'

function Panel({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      className="space-y-4 rounded-xl bg-pale-lavender px-8 py-10 text-center"
    >
      {children}
    </div>
  )
}

/** Board read failed. Filters stay in the URL and on screen; Try again re-runs the read. */
export function JobsError() {
  const router = useRouter()
  return (
    <Panel alert>
      <p className="font-headline text-xl text-brand-black">We couldn&apos;t load jobs just now</p>
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Nothing is wrong with your filters. Please try again.
      </p>
      <button type="button" onClick={() => router.refresh()} className={ctaClass}>
        Try again
      </button>
    </Panel>
  )
}

/** Filters matched nothing. */
export function JobsNoMatch() {
  return (
    <Panel>
      <p className="font-headline text-xl text-brand-black">No roles match these filters</p>
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Try removing a filter to see more roles.
      </p>
      <Link href="/jobs" scroll={false} className={ctaClass}>
        Clear filters
      </Link>
    </Panel>
  )
}

/** No open roles at all. `postHref` is set only when posting is open. Owners are sent to post one; everyone else to the businesses. */
export function JobsEmpty({ isOwner, postHref }: { isOwner: boolean; postHref?: string }) {
  return (
    <Panel>
      <p className="font-headline text-xl text-brand-black">No open roles right now</p>
      <p className="font-body text-sm leading-relaxed text-charcoal">
        Roles appear once businesses post them and our team approves them.
      </p>
      <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
        {isOwner && postHref ? (
          <Link href={postHref} className={ctaClass}>
            Post the first one
          </Link>
        ) : (
          <Link href="/discover" className={secondaryCtaClass}>
            Browse businesses
          </Link>
        )}
      </div>
    </Panel>
  )
}
