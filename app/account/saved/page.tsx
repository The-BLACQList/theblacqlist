import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bookmark, ExternalLink } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { SaveButton } from '@/components/entity-page/SaveButton'
import { EmptyState } from '@/components/ui/empty-state'
import { buildEntityUrl } from '@/lib/listings/url'
import { untyped } from '@/lib/actions/saved-lists/shared'

import { ListRail, type RailList } from './ListRail'
import { ListPicker } from './ListPicker'
import { SavedLoadError } from './SavedLoadError'

interface SavedPageProps {
  searchParams: Promise<{ list?: string }>
}

export default async function SavedListingsPage({ searchParams }: SavedPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/account/saved')

  const { list: requestedListId } = await searchParams

  const { data: saves, error: savesError } = await supabase
    .from('saves')
    .select(
      `
      id,
      listing_id,
      created_at,
      listings!inner(
        id, name, slug, tagline, entity_type, trust_tier, status,
        cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
        listing_details_business(phone, website_url)
      )
    `
    )
    .eq('user_id', user.id)
    .is('listings.deleted_at', null)
    .eq('listings.status', 'published')
    .order('created_at', { ascending: false })

  if (savesError) {
    return (
      <main>
        <div className="max-w-[960px] mx-auto">
          <h1 className="font-headline text-3xl text-brand-black mb-2">Saved businesses</h1>
          <SavedLoadError />
        </div>
      </main>
    )
  }

  const listings = (saves ?? []).map((s) => {
    const l = s.listings as unknown as {
      id: string
      name: string
      slug: string
      tagline: string | null
      entity_type: string
      trust_tier: string
      cities: { name: string; slug: string; states: { code: string } | null } | null
      listing_details_business: { phone: string | null; website_url: string | null } | null
    }
    return {
      saveId: s.id,
      listingId: s.listing_id,
      name: l.name,
      slug: l.slug,
      tagline: l.tagline,
      entity_type: l.entity_type,
      trust_tier: l.trust_tier,
      city: l.cities ? `${l.cities.name}, ${l.cities.states?.code ?? ''}` : null,
      citySlug: l.cities?.slug ?? null,
      website_url: l.listing_details_business?.website_url ?? null,
    }
  })

  // `saved_lists` / `saved_list_items` post-date `lib/supabase/types.ts`, so the
  // generated `Database` type does not know them — same escape hatch as
  // `lib/listings/entityPage.ts:132`. RLS still scopes both reads to this user.
  const sb = untyped(supabase)

  const { data: listRows } = await sb
    .from('saved_lists')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  const rawLists = (listRows ?? []) as { id: string; name: string }[]

  const { data: itemRows } =
    rawLists.length > 0
      ? await sb
          .from('saved_list_items')
          .select('list_id, save_id')
          .in(
            'list_id',
            rawLists.map((l) => l.id)
          )
      : { data: [] }

  const items = (itemRows ?? []) as { list_id: string; save_id: string }[]

  // Only memberships whose save is actually visible here count — a listing that
  // was unpublished after being filed should not inflate a list's badge.
  const visibleSaveIds = new Set(listings.map((l) => l.saveId))
  const listsBySave = new Map<string, string[]>()
  const countByList = new Map<string, number>()

  for (const item of items) {
    if (!visibleSaveIds.has(item.save_id)) continue
    listsBySave.set(item.save_id, [...(listsBySave.get(item.save_id) ?? []), item.list_id])
    countByList.set(item.list_id, (countByList.get(item.list_id) ?? 0) + 1)
  }

  const nameByList = new Map(rawLists.map((l) => [l.id, l.name]))
  const lists: RailList[] = rawLists.map((l) => ({
    id: l.id,
    name: l.name,
    count: countByList.get(l.id) ?? 0,
  }))

  // An unknown or just-deleted `?list=` falls back to All saved rather than
  // rendering an empty view for a list that no longer exists.
  const activeListId = requestedListId && nameByList.has(requestedListId) ? requestedListId : null
  const activeListName = activeListId ? nameByList.get(activeListId)! : null

  const visible = activeListId
    ? listings.filter((l) => (listsBySave.get(l.saveId) ?? []).includes(activeListId))
    : listings

  const pickerLists = rawLists.map((l) => ({ id: l.id, name: l.name }))

  return (
    <main>
      <div className="max-w-[960px] mx-auto">
        <h1 className="font-headline text-3xl text-brand-black mb-2">Saved businesses</h1>
        <p className="font-subhead text-sm text-charcoal-soft mb-8">
          {listings.length === 0
            ? 'Businesses you save will appear here.'
            : `${listings.length} saved ${listings.length === 1 ? 'business' : 'businesses'}`}
        </p>

        {listings.length > 0 && (
          <ListRail lists={lists} activeListId={activeListId} totalCount={listings.length} />
        )}

        {listings.length === 0 ? (
          <EmptyState
            level={2}
            icon={Bookmark}
            heading="No saved businesses yet"
            body="Tap the heart icon on any listing to save it here for later."
            action={{ label: 'Discover businesses', href: '/discover' }}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            level={2}
            icon={Bookmark}
            heading={`Nothing in “${activeListName}” yet`}
            body="Open a saved business and use its list button to file it here."
            action={{ label: 'View all saved', href: '/account/saved' }}
          />
        ) : (
          <ul className="space-y-3" aria-label="Saved businesses">
            {visible.map((l) => {
              const memberOf = listsBySave.get(l.saveId) ?? []
              return (
                <li
                  key={l.saveId}
                  className="bg-white rounded-xl border border-charcoal/10 p-4 flex items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={buildEntityUrl(l.entity_type, l.citySlug, l.slug)}
                      className="font-headline text-base text-brand-black hover:text-amber transition-colors line-clamp-1"
                    >
                      {l.name}
                    </Link>
                    {l.tagline && (
                      <p className="font-subhead text-sm text-charcoal-soft mt-0.5 line-clamp-1">
                        {l.tagline}
                      </p>
                    )}
                    {l.city && (
                      <p className="font-subhead text-xs text-charcoal-faint mt-1">{l.city}</p>
                    )}
                    {memberOf.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5 mt-2" aria-label={`Lists for ${l.name}`}>
                        {memberOf.map((listId) => (
                          <li
                            key={listId}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-pale-lavender font-subhead text-xs text-charcoal"
                          >
                            {nameByList.get(listId)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.website_url && (
                      <a
                        href={l.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${l.name} website`}
                        className="inline-flex items-center justify-center size-11 rounded-full text-charcoal-faint hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                      </a>
                    )}
                    <ListPicker
                      listingId={l.listingId}
                      listingName={l.name}
                      lists={pickerLists}
                      memberOf={memberOf}
                    />
                    <SaveButton listingId={l.listingId} initialSaved={true} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </main>
  )
}
