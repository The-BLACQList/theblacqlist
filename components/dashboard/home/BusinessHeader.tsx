import Link from 'next/link'
import { ExternalLink, Pencil } from 'lucide-react'
import { getPlanMeta } from '@/lib/stripe/plans'
import { statusLabel } from '@/lib/dashboard/home'

const PLAN_SLUGS = ['free', 'starter', 'growth', 'premium'] as const

// Business Home's top band (ticket 253): which page this is, whether it is
// live, its plan, and the two things owners do most. Black ground with the
// gold node, like the rail beside it.
export function BusinessHeader({
  pageId,
  name,
  status,
  tier,
  publicUrl,
}: {
  pageId: string
  name: string
  status: string | null
  tier: string | null
  publicUrl: string | null
}) {
  const plan = PLAN_SLUGS.find((s) => s === tier) ?? 'free'
  const live = status === 'published'
  return (
    <header className="rounded-2xl bg-deep-bg px-5 py-6 sm:px-7 sm:py-7">
      <p className="font-headline text-sm font-medium uppercase tracking-[0.16em] text-gold">
        Your Business
      </p>
      <h1 className="mt-2 font-headline text-3xl leading-tight text-white sm:text-4xl">{name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          data-testid="home-status"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 font-subhead text-sm text-white"
        >
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${live ? 'bg-gold' : 'bg-ink-soft'}`}
          />
          {statusLabel(status)}
        </span>
        <span className="inline-flex items-center rounded-full border border-gold/50 px-3 py-1 font-subhead text-sm text-gold">
          {getPlanMeta(plan).name} Plan
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {publicUrl && live && (
          <Link
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-gold px-5 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
          >
            View Live Page <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        )}
        <Link
          href={`/dashboard/pages/${pageId}/edit`}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/30 px-5 font-subhead text-sm font-semibold text-white transition-colors hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg"
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit Page
        </Link>
      </div>
    </header>
  )
}
