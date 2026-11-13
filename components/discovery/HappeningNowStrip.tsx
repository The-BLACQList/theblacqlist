import Image from 'next/image'
import { Container } from '@/components/layout/container'
import { trackServerEvents } from '@/lib/analytics/server'
import { SERVER_ONLY_EVENTS } from '@/lib/analytics/constants'
import { endsLabel, postClickHref } from '@/lib/listings/happeningNow'
import { loadHappeningNowFeed } from '@/lib/listings/happeningNowFeed'

// "Happening now" on city and city + category pages (owner-experience round 2,
// part F): live posts from business pages there, soonest ending first, at most
// 8. Renders nothing when there are none or the flag is off.
//
// Each card goes through /api/happening-now/[postId]?from=strip, which counts
// the click and opens the business page. Plain links, not next/link: a
// prefetch would count as a click.

interface Props {
  cityId: string
  categoryId?: string
  /** "in Atlanta", "in Restaurants in Atlanta" */
  placeLabel: string
}

export async function HappeningNowStrip({ cityId, categoryId, placeLabel }: Props) {
  const items = await loadHappeningNowFeed({ cityId, categoryId })
  if (items.length === 0) return null

  trackServerEvents(
    items.map(({ post, listing }) => ({
      event_name: SERVER_ONLY_EVENTS.POST_VIEW,
      entity_id: listing.id,
      entity_type: 'listing',
      properties: { post_id: post.id, surface: 'strip' },
    }))
  )
  const now = new Date()

  return (
    <section
      aria-labelledby="happening-now-heading"
      className="border-b border-charcoal/10 bg-off-white"
    >
      <Container className="py-5">
        <h2
          id="happening-now-heading"
          className="flex items-center gap-2 font-subhead text-sm font-semibold text-brand-black"
        >
          <span aria-hidden className="size-2 rounded-full bg-amber" />
          Happening now <span className="font-normal text-charcoal-soft">{placeLabel}</span>
        </h2>
        <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          {items.map(({ post, listing }) => {
            const picture = post.imageUrl ?? listing.logoUrl
            return (
              <li key={post.id} className="w-64 shrink-0 snap-start">
                <a
                  href={postClickHref(post.id, 'strip')}
                  rel="nofollow"
                  className="flex h-full gap-3 rounded-xl border border-hairline bg-white p-3 transition-colors hover:border-charcoal/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
                >
                  {picture ? (
                    <Image
                      src={picture}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-14 shrink-0 items-center justify-center rounded-md bg-pale-lavender font-headline text-lg text-charcoal"
                    >
                      {listing.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-charcoal-soft">
                      {listing.name}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-brand-black">
                      {post.headline}
                    </span>
                    <span className="mt-1 block text-xs text-amber">
                      {endsLabel(post.endsAt, now)}
                    </span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}
