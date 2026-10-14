// The help a thin search gets instead of a blank page (PR 5).
//
// Rendered only when the exact search found fewer than three listings (see
// shouldAssist in lib/search/assist.ts). Everything it shows comes from
// getSearchAssist, so every card and count is a real published listing, and
// every loose result is labeled as a close match, never as an answer.

import Link from 'next/link'
import { CardGrid } from '@/components/ui/card-grid'
import { EntityCard } from '@/components/entities/EntityCard'
import type { ListingsParams } from '@/lib/listings/query'
import { getSearchAssist, type NearbyCity, type SearchAssistData } from '@/lib/services/searchAssist'

const linkClass =
  'font-subhead text-sm text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber rounded-sm'

const chipClass =
  'inline-flex items-center gap-2 min-h-[44px] rounded-full border border-charcoal/20 bg-white px-4 py-2 font-subhead text-sm text-brand-black hover:bg-pale-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'

const subheadClass = 'font-headline text-lg text-brand-black mb-3'

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`
}

function WordList({ words }: { words: string[] }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={w}>
          {i > 0 && ', '}
          <strong className="font-bold">{w}</strong>
        </span>
      ))}
    </>
  )
}

function NearbyLine({ prefix, city }: { prefix: string; city: NearbyCity }) {
  return (
    <p className="font-subhead text-sm text-charcoal">
      {prefix && `${prefix} `}The closest city we cover is {city.name}, about{' '}
      {plural(city.miles, 'mile', 'miles')} away.{' '}
      <Link href={city.href} className={linkClass}>
        Browse {city.name}
      </Link>
    </p>
  )
}

function chipCount(chip: SearchAssistData['chips'][number], scopeLabel: string | null): string | null {
  if (chip.localCount && scopeLabel) return `${chip.localCount.toLocaleString()} ${scopeLabel}`
  if (chip.nationalCount != null) return `${chip.nationalCount.toLocaleString()} nationwide`
  return null
}

export function SearchAssistPanel({ data }: { data: SearchAssistData }) {
  const { query, exactTotal, scopeLabel, close, chips, gaps, uncovered, nearestToYou, elsewhere, online, explore } =
    data

  return (
    <section aria-labelledby="search-assist-heading" className="flex flex-col gap-10 py-6">
      <header className="flex flex-col gap-1">
        <h2 id="search-assist-heading" className="font-headline text-xl text-brand-black">
          {exactTotal === 0 ? `No exact match for "${query}"` : 'More to explore'}
        </h2>
        <p className="font-subhead text-sm text-charcoal max-w-prose">
          {exactTotal === 0
            ? 'Here is the closest help we have.'
            : 'Only a few businesses matched every word, so here are some related ones.'}
        </p>
      </header>

      {(uncovered.length > 0 || nearestToYou) && (
        <div className="flex flex-col gap-2">
          {uncovered.map((u) =>
            u.nearest ? (
              <NearbyLine key={u.label} prefix={`We don't list businesses in ${u.label} yet.`} city={u.nearest} />
            ) : (
              <p key={u.label} className="font-subhead text-sm text-charcoal">
                We don&apos;t list businesses in {u.label} yet.
              </p>
            )
          )}
          {nearestToYou && <NearbyLine prefix="" city={nearestToYou} />}
        </div>
      )}

      {close && (
        <div>
          <h3 className={subheadClass}>
            Close matches for <WordList words={close.words} />
            {scopeLabel ? ` ${scopeLabel}` : ''}
          </h3>
          <p className="font-subhead text-sm text-charcoal mb-4">
            These match some of your words, not all of them.
          </p>
          <CardGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} gap="md">
            {close.entities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} />
            ))}
          </CardGrid>
        </div>
      )}

      {chips.length > 0 && (
        <div>
          <h3 className={subheadClass}>Related categories</h3>
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => {
              const count = chipCount(chip, scopeLabel)
              return (
                <li key={chip.slug}>
                  <Link href={chip.href} className={chipClass}>
                    {chip.name}
                    {count && <span className="text-charcoal">{count}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {gaps.length > 0 && (
        <p className="font-subhead text-sm text-charcoal max-w-prose">
          We don&apos;t have any listings in {gaps.join(' or ')} yet. Know a business that belongs
          here?{' '}
          <Link href="/add-business" className={linkClass}>
            Add it
          </Link>
        </p>
      )}

      {(elsewhere || online) && (
        <ul className="flex flex-col gap-2">
          {elsewhere && (
            <li className="font-subhead text-sm text-charcoal">
              {plural(elsewhere.count, 'business matches', 'businesses match')} &quot;{query}&quot; in
              other places.{' '}
              <Link href={elsewhere.href} className={linkClass}>
                Search everywhere
              </Link>
            </li>
          )}
          {online && (
            <li className="font-subhead text-sm text-charcoal">
              {plural(online.count, 'business that works', 'businesses that work')} online{' '}
              {online.count === 1 ? 'matches' : 'match'} some of your words.{' '}
              <Link href={online.href} className={linkClass}>
                See online businesses
              </Link>
            </li>
          )}
        </ul>
      )}

      {explore && (
        <div className="flex flex-col gap-6">
          {explore.categories.length > 0 && (
            <div>
              <h3 className={subheadClass}>Popular categories</h3>
              <ul className="flex flex-wrap gap-2">
                {explore.categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/discover?category=${encodeURIComponent(c.slug)}`} className={chipClass}>
                      {c.name}
                      {c.count != null && <span className="text-charcoal">{c.count.toLocaleString()}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {explore.cities.length > 0 && (
            <div>
              <h3 className={subheadClass}>Cities we cover</h3>
              <ul className="flex flex-wrap gap-2">
                {explore.cities.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/discover/${c.slug}`} className={chipClass}>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="font-subhead text-sm text-charcoal">
            Or see every business at once.{' '}
            <Link href="/map" className={linkClass}>
              Open the map
            </Link>
          </p>
        </div>
      )}
    </section>
  )
}

/** Loads the follow-ups for one thin search and renders them. */
export async function SearchAssist(props: {
  params: ListingsParams
  exactIds: readonly string[]
  exactTotal: number
}) {
  let data: SearchAssistData
  try {
    data = await getSearchAssist(props)
  } catch {
    // The follow-ups are extra help. If they cannot load, say so plainly and
    // leave the two ways out that need no database.
    return (
      <section aria-labelledby="search-assist-heading" className="py-6 flex flex-col gap-2">
        <h2 id="search-assist-heading" className="font-headline text-xl text-brand-black">
          {props.exactTotal === 0 ? `No exact match for "${props.params.q ?? ''}"` : 'More to explore'}
        </h2>
        <p className="font-subhead text-sm text-charcoal">
          We couldn&apos;t load suggestions just now.{' '}
          <Link href="/discover" className={linkClass}>
            Browse every business
          </Link>{' '}
          or{' '}
          <Link href="/map" className={linkClass}>
            open the map
          </Link>
          .
        </p>
      </section>
    )
  }
  return <SearchAssistPanel data={data} />
}
