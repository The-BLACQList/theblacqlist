import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import {
  countsTowardLimit,
  endsLabel,
  shownPosts,
  type OwnerPost,
} from '@/lib/listings/happeningNow'
import { activePostLimit } from '@/lib/stripe/features'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

// Happening now, at the top of the edit page's Basics tab (part F): what is up
// now and a link to the posts page, where posts are written. No form here.

interface Props {
  listingId: string
  posts: readonly OwnerPost[]
  tier: string | null
  /** The plan the note offers on a page that can't post (`upgradeTarget`). */
  upgradeTo: UpgradeTarget
  /** When the page was read, so the server and the browser agree. */
  now: string
}

export function HappeningNowCard({ listingId, posts, tier, upgradeTo, now }: Props) {
  const at = new Date(now)
  const limit = activePostLimit(tier)
  const live = shownPosts(posts, tier, at).shown
  const scheduled = posts.filter((p) => countsTowardLimit(p, at) && Date.parse(p.starts_at) > at.getTime())
  const href = `/dashboard/pages/${listingId}/posts`

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-headline text-base text-brand-black">Happening now</h2>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            A short dated post at the top of your page and on your city page: a sale, a pop-up, a
            new menu.
          </p>
        </div>
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 font-subhead text-sm font-semibold text-brand-black underline underline-offset-4 decoration-amber-gold hover:decoration-brand-black"
        >
          {posts.length > 0 ? 'Manage posts' : 'Write a post'}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="px-5 py-4 space-y-3">
        {live.length > 0 ? (
          <ul className="space-y-2">
            {live.map((post) => (
              <li key={post.id} className="flex items-baseline gap-2">
                <span className="rounded-full bg-success/10 px-2 py-0.5 font-subhead text-xs font-semibold text-success">
                  Live
                </span>
                <span className="min-w-0 flex-1 truncate font-subhead text-sm text-brand-black">
                  {post.headline}
                </span>
                <span className="shrink-0 font-body text-xs text-charcoal-soft">
                  {endsLabel(post.ends_at, at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-body text-sm text-charcoal-soft">Nothing is up right now.</p>
        )}
        {scheduled.length > 0 && (
          <p className="font-body text-xs text-charcoal-soft">
            {scheduled.length === 1 ? '1 post is' : `${scheduled.length} posts are`} scheduled.
          </p>
        )}
        {limit === 0 ? (
          <PlanLimitNote upgradeTo={upgradeTo}>
            Happening now posts are part of Starter. Upgrade to post one on your page.
          </PlanLimitNote>
        ) : (
          <p className="font-body text-xs text-charcoal-faint">
            {limit === null
              ? 'Your plan has no limit on posts.'
              : `Your plan shows ${limit === 1 ? '1 post' : `up to ${limit} posts`} at a time.`}
          </p>
        )}
      </div>
    </div>
  )
}
