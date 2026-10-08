import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { BlogPostCard } from '@/components/editorial/BlogPostCard'
import { createClient } from '@/lib/supabase/server'
import { resolveStoryCover } from '@/lib/editorial/cover'
import { PHOTO_FOCAL } from '@/lib/design/surfaces'
import { cn } from '@/lib/utils'
import { editorialKind } from '@/lib/editorial/kind'
import { readMinutes } from '@/lib/editorial/readTime'
import { firstPullQuote } from '@/lib/editorial/inline'
import { loadLinkedListings } from '@/lib/editorial/linkedListings'

export const metadata: Metadata = {
  title: 'BLACQLight | The BLACQList',
  description:
    'The people behind the businesses, the movements around them, and guides to spending on purpose.',
}

// Ticket 116, The BLACQLight A ("Cover story"). Spec:
// docs/blacqlist/design/page-workshop-2026-10-spec.md §3.

interface Props {
  searchParams: Promise<{ all?: string }>
}

const MORE_COUNT = 3
const DIRECTORY_MAX = 6

const eyebrow = 'font-subhead text-xs font-bold uppercase tracking-[0.14em]'
const pill =
  'inline-flex min-h-[48px] items-center justify-center px-6 rounded-full font-subhead text-[15px] font-semibold transition-colors duration-150'

export default async function BLACQLightPage({ searchParams }: Props) {
  const { all } = await searchParams
  const showAll = all === '1'
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('editorial_articles')
    .select('id, title, slug, subtitle, body, author_name, published_at, tags, cover_image_path')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (error) console.error('[blacqlight] articles query failed:', error.message)

  const articles = data ?? []
  const [lead, ...rest] = articles
  const more = showAll ? rest : rest.slice(0, MORE_COUNT)
  const onPage = lead ? [lead, ...more] : []
  const directory = await loadLinkedListings(
    supabase,
    onPage.map((a) => a.body),
    DIRECTORY_MAX
  )
  const quote = lead ? firstPullQuote(lead.body) : null
  const leadCover = lead ? resolveStoryCover(lead.cover_image_path) : null
  const leadKind = lead ? editorialKind(lead.tags) : null

  return (
    <main className="min-h-screen bg-off-white">
      {/* 1. Header */}
      <section className="bg-deep-bg" aria-labelledby="blacqlight-heading">
        <Container className="pt-14 md:pt-20 pb-10 md:pb-14 flex flex-col gap-4">
          <p className={`${eyebrow} text-gold`}>Stories from the list</p>
          <h1
            id="blacqlight-heading"
            className="font-headline font-medium text-[clamp(48px,9vw,112px)] leading-[0.95] tracking-[-0.02em] text-off-white"
          >
            The BLACQLight
          </h1>
          <p className="font-body text-lg leading-relaxed text-ink-soft max-w-[56ch]">
            The people behind the businesses, the movements around them, and guides to spending on
            purpose.
          </p>
        </Container>
      </section>

      {error ? (
        <LoadFailure />
      ) : !lead ? (
        <Empty />
      ) : (
        <>
          {/* 2. Lead story: the whole card is one link */}
          <section className="bg-deep-bg" aria-label="Lead story">
            <Container className="pb-16 md:pb-24">
              <Link
                href={`/blacqlight/${lead.slug}`}
                className="group grid gap-8 border-t border-off-white/20 pt-10 lg:grid-cols-2 lg:items-center rounded-[3px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
              >
                {leadCover && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-charcoal">
                    <Image
                      src={leadCover}
                      alt=""
                      fill
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className={cn(
                        'object-cover grayscale transition duration-300 group-hover:grayscale-0 motion-reduce:transition-none',
                        PHOTO_FOCAL[leadCover]
                      )}
                    />
                  </div>
                )}
                <div
                  className={`flex flex-col gap-4 ${leadCover ? '' : 'lg:col-span-2 max-w-[48rem]'}`}
                >
                  {leadKind && <p className={`${eyebrow} text-gold`}>{leadKind}</p>}
                  <h2 className="font-headline font-medium text-[clamp(32px,4vw,56px)] leading-[1.05] text-off-white text-balance">
                    {lead.title}
                  </h2>
                  {lead.subtitle && (
                    <p className="font-body text-lg leading-relaxed text-ink-soft max-w-[52ch]">
                      {lead.subtitle}
                    </p>
                  )}
                  <p className="font-subhead text-sm text-ink-soft">
                    By {lead.author_name} · {readMinutes(lead.body)} min read
                  </p>
                  <span
                    className={`${pill} self-start mt-2 border border-gold text-gold group-hover:bg-gold group-hover:text-brand-black`}
                  >
                    Read the story
                  </span>
                </div>
              </Link>
            </Container>
          </section>

          {/* 3. Pull quote band: only when the lead has a blockquote */}
          {quote && (
            <section className="bg-pale-lavender" aria-label="From the lead story">
              <Container className="py-14 md:py-20">
                <figure className="flex flex-col gap-5 max-w-[48rem] mx-auto text-center">
                  <blockquote className="font-headline text-[clamp(26px,3.2vw,40px)] leading-snug text-brand-black text-balance">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <figcaption className="font-subhead text-sm text-charcoal">
                    From{' '}
                    <Link
                      href={`/blacqlight/${lead.slug}`}
                      className="font-semibold text-amber underline underline-offset-4 hover:text-brand-black"
                    >
                      {lead.title}
                    </Link>
                  </figcaption>
                </figure>
              </Container>
            </section>
          )}

          {/* 4. More stories */}
          {more.length > 0 && (
            <section className="bg-off-white" aria-labelledby="more-heading">
              <Container className="py-16 md:py-20 flex flex-col gap-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <h2
                    id="more-heading"
                    className="font-headline font-medium text-[30px] md:text-[40px] leading-[1.1] text-ink"
                  >
                    More stories
                  </h2>
                  {!showAll && rest.length > MORE_COUNT && (
                    <Link
                      href="/blacqlight?all=1"
                      className={`${pill} border border-brand-black text-brand-black hover:bg-brand-black hover:text-off-white`}
                    >
                      All stories
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {more.map((a) => (
                    <BlogPostCard
                      key={a.id}
                      title={a.title}
                      slug={a.slug}
                      subtitle={a.subtitle}
                      authorName={a.author_name}
                      headingLevel="h3"
                      kind={editorialKind(a.tags)}
                      readMinutes={readMinutes(a.body)}
                      coverSrc={resolveStoryCover(a.cover_image_path)}
                    />
                  ))}
                </div>
              </Container>
            </section>
          )}

          {/* 5. From the directory: hidden when the stories link no listings */}
          {directory.length > 0 && (
            <section className="bg-white" aria-labelledby="directory-heading">
              <Container className="py-14 md:py-20 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <p className={`${eyebrow} text-amber`}>From the directory</p>
                  <h2
                    id="directory-heading"
                    className="font-headline font-medium text-[26px] md:text-[34px] leading-[1.1] text-ink"
                  >
                    The businesses in these stories
                  </h2>
                </div>
                <ul className="flex flex-wrap gap-3 list-none m-0 p-0">
                  {directory.map((l) => (
                    <li key={l.id}>
                      <Link
                        href={l.href}
                        className={`${pill} border border-hairline bg-off-white text-ink hover:border-amber hover:text-amber`}
                      >
                        {l.category ? `${l.name} · ${l.category}` : l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Container>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function Empty() {
  return (
    <section className="bg-white">
      <Container className="py-16 text-center">
        <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
          Stories coming soon
        </p>
        <p className="font-body text-sm text-charcoal-soft">
          BLACQLight editorials are on the way. Check back soon.
        </p>
        <Link
          href="/discover"
          className={`${pill} mt-5 border border-brand-black text-brand-black hover:bg-brand-black hover:text-white`}
        >
          Explore businesses now
        </Link>
      </Container>
    </section>
  )
}

/** A failed query is not "no stories". Say so, and offer a retry. */
function LoadFailure() {
  return (
    <section className="bg-white" role="alert">
      <Container className="py-16 text-center">
        <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
          Couldn&apos;t load stories
        </p>
        <p className="font-body text-sm text-charcoal-soft">
          Something went wrong while loading them. Try again in a moment.
        </p>
        <Link
          href="/blacqlight"
          prefetch={false}
          className={`${pill} mt-5 bg-gold text-brand-black hover:bg-light-gold`}
        >
          Try again
        </Link>
      </Container>
    </section>
  )
}
