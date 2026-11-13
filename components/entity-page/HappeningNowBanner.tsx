import Image from 'next/image'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { Container } from '@/components/layout/container'
import { endsLabel, postClickHref, type PublicPost } from '@/lib/listings/happeningNow'

// Happening now (owner-experience round 2, part F). A band above the hero, on
// every template: the post ending soonest, and the rest under "+N more".
//
// Buttons are plain links through /api/happening-now/[postId], which counts
// the click and redirects. Not next/link: a prefetch would count as a click.

interface Props {
  posts: readonly PublicPost[]
  /** When the page was read, so the "Ends in" line matches the posts shown. */
  now: Date
}

export function HappeningNowBanner({ posts, now }: Props) {
  const [first, ...more] = posts
  if (!first) return null

  return (
    <section aria-label="Happening now" className="border-b border-white/10 bg-ground text-white">
      <Container className="py-3 md:py-4">
        <PostRow post={first} now={now} />
        {more.length > 0 && (
          <details className="group mt-2">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full text-xs font-semibold text-gold hover:text-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
              +{more.length} more
              <ChevronDown
                aria-hidden
                className="size-3.5 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="mt-3 space-y-3 border-t border-white/10 pt-3">
              {more.map((post) => (
                <li key={post.id}>
                  <PostRow post={post} now={now} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </Container>
    </section>
  )
}

function PostRow({ post, now }: { post: PublicPost; now: Date }) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
        {post.imageUrl && (
          <Image
            src={post.imageUrl}
            alt=""
            width={56}
            height={56}
            className="size-12 shrink-0 rounded-md object-cover md:size-14"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold tracking-wide text-gold uppercase">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-1.5 rounded-full bg-gold" />
              Happening now
            </span>
            <span className="font-normal tracking-normal text-ink-soft normal-case">
              {endsLabel(post.endsAt, now)}
            </span>
          </p>
          <p className="mt-0.5 text-sm font-semibold break-words md:text-base">{post.headline}</p>
          {post.body && <p className="mt-0.5 text-sm break-words text-ink-soft">{post.body}</p>}
        </div>
      </div>
      {post.buttonLabel && (
        <a
          href={postClickHref(post.id, 'page')}
          rel="nofollow noopener"
          className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-full sm:self-auto bg-gold px-3.5 py-2 text-sm font-semibold text-ground hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          {post.buttonLabel}
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      )}
    </div>
  )
}
