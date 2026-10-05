import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { ImageFallback } from '@/components/media/ImageFallback'
import { signOutAction } from '@/lib/actions/auth/signOut'
import {
  OWNERSHIP_LABEL_META,
  TRUST_TIER_META,
  type OwnershipLabel,
  type TrustTier,
} from '@/lib/constants/listing'
import { EGO_MAX_NODES_WIDE, summarizeEgoSpend, type EgoReceipt } from '@/lib/account/egoNetwork'
import { formatDollars } from '@/lib/spend/personal-spend'
import {
  CollectivePanel,
  CollectiveSoonPanel,
  type CollectiveBusiness,
} from '@/components/account/CollectivePanel'
import { isCovered } from '@/lib/features/covered'

export const metadata: Metadata = { title: 'My Account | The BLACQList' }

// Ticket 114 (My Account A). Spec: docs/blacqlist/design/page-workshop-2026-10-spec.md §1.
// Every query is the signed-in user's own rows under the existing RLS. Each
// section checks its own query, so one failure never takes the page down.

interface RecentSave {
  id: string
  name: string
  slug: string
  entityType: string
  categoryName: string | null
  citySlug: string | undefined
  cityName: string | null
  coverSrc: string | null
  trustTier: string | null
  ownershipLabel: string | null
}

function SectionError({ onDark = false, className = '' }: { onDark?: boolean; className?: string }) {
  return (
    <p
      className={`font-subhead text-sm ${onDark ? 'text-ink-soft' : 'text-charcoal'} ${className}`}
      role="status"
    >
      Couldn&apos;t load this.{' '}
      <Link
        href="/account"
        prefetch={false}
        className={`inline-flex min-h-[44px] items-center font-semibold underline underline-offset-2 ${
          onDark ? 'text-light-gold hover:text-off-white' : 'text-amber hover:text-brand-black'
        }`}
      >
        Try again
      </Link>
    </p>
  )
}

function RowLink({ href, label, meta, metaStrong = false }: {
  href: string
  label: string
  meta?: string | null
  metaStrong?: boolean
}) {
  return (
    <li className="border-t border-hairline">
      <Link
        href={href}
        className="group flex min-h-[52px] items-center gap-3 py-2 font-subhead text-[15px] text-ink"
      >
        <span className="flex-1 min-w-0 truncate font-semibold group-hover:underline underline-offset-2">
          {label}
        </span>
        {meta && (
          <span
            className={`shrink-0 text-sm ${metaStrong ? 'font-semibold text-amber' : 'text-charcoal'}`}
          >
            {meta}
          </span>
        )}
        <ChevronRight className="size-4 shrink-0 text-charcoal-faint" aria-hidden="true" />
      </Link>
    </li>
  )
}

/** Dividers for the 2×2 stat grid on phones and the single row from lg up. */
const STAT_DIVIDERS = [
  '',
  'pl-4 border-l',
  'max-lg:mt-4 max-lg:border-t lg:pl-4 lg:border-l',
  'pl-4 border-l max-lg:mt-4 max-lg:border-t',
]

/** "{Tier} · {Black-Owned or Ally}". The tier shows only from Claimed up. */
function trustLine(trustTier: string | null, ownershipLabel: string | null): string {
  const tier =
    trustTier && trustTier !== 'unclaimed' ? TRUST_TIER_META[trustTier as TrustTier]?.label : null
  const label = ownershipLabel ? OWNERSHIP_LABEL_META[ownershipLabel as OwnershipLabel]?.label : null
  return [tier, label].filter(Boolean).join(' · ')
}

export default async function AccountOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/account')

  // Never fall back to the email prefix: no piece of the email shows on screen.
  const displayName = (user.user_metadata?.display_name as string | undefined)?.trim() || null

  const [savesRes, savedCountRes, reviewsCountRes, latestClaimRes, receiptsRes, ownedRes] =
    await Promise.all([
      supabase
        .from('saves')
        .select(
          'id, listings!inner(id, name, slug, entity_type, cover_image_path, status, deleted_at, trust_tier, ownership_label, categories(name), cities!listings_city_id_fkey(name, slug))'
        )
        .eq('user_id', user.id)
        .eq('listings.status', 'published')
        .is('listings.deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase.from('saves').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_user_id', user.id),
      supabase
        .from('claims')
        .select('id, status, created_at, listings!claims_listing_id_fkey(name)')
        .eq('claimant_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Every status: summarizeEgoSpend counts approved money and pending as a
      // count only, the same rule as buildTotals on /account/spending.
      supabase
        .from('receipt_uploads')
        .select('amount_cents, status, listing_id')
        .eq('user_id', user.id),
      supabase
        .from('listings')
        .select('id, name, slug, entity_type, trust_tier, cities!listings_city_id_fkey(slug)')
        .eq('owner_user_id', user.id)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle(),
    ])

  const recentSaves: RecentSave[] = (savesRes.data ?? []).map((s) => {
    const l = s.listings as unknown as {
      id: string
      name: string
      slug: string
      entity_type: string
      cover_image_path: string | null
      trust_tier: string | null
      ownership_label: string | null
      categories: { name: string } | null
      cities: { name: string; slug: string } | null
    }
    return {
      id: l.id,
      name: l.name,
      slug: l.slug,
      entityType: l.entity_type,
      categoryName: l.categories?.name ?? null,
      citySlug: l.cities?.slug,
      cityName: l.cities?.name ?? null,
      coverSrc: resolveCoverImage(l.cover_image_path, l.entity_type, l.id).src,
      trustTier: l.trust_tier,
      ownershipLabel: l.ownership_label,
    }
  })

  const savedCount = savedCountRes.error ? null : (savedCountRes.count ?? 0)
  const reviewsCount = reviewsCountRes.error ? null : (reviewsCountRes.count ?? 0)
  const latestClaim = latestClaimRes.data as
    | { id: string; status: string; listings: { name: string } | null }
    | null
  const pendingClaim = latestClaim?.status === 'pending' ? latestClaim : null
  const ownedListing = ownedRes.data as
    | {
        id: string
        name: string
        slug: string
        entity_type: string
        trust_tier: string
        cities: { slug: string } | null
      }
    | null

  const spend = receiptsRes.error
    ? null
    : summarizeEgoSpend((receiptsRes.data ?? []) as EgoReceipt[])
  const receiptsCount = receiptsRes.error ? null : (receiptsRes.data ?? []).length

  // Names, categories and links for the top businesses on the ring. A listing
  // that is gone or unpublished stays on the ring without a link.
  let collectiveBusinesses: CollectiveBusiness[] = []
  let listingsError = false
  if (spend && spend.businesses.length > 0) {
    const top = spend.businesses.slice(0, EGO_MAX_NODES_WIDE)
    const { data, error } = await supabase
      .from('listings')
      .select(
        'id, name, slug, entity_type, status, deleted_at, categories(name), cities!listings_city_id_fkey(slug)'
      )
      .in(
        'id',
        top.map((b) => b.listingId)
      )
    listingsError = Boolean(error)
    const byId = new Map(
      ((data ?? []) as unknown as Array<{
        id: string
        name: string
        slug: string
        entity_type: string
        status: string
        deleted_at: string | null
        categories: { name: string } | null
        cities: { slug: string } | null
      }>).map((l) => [l.id, l])
    )
    collectiveBusinesses = top.map((b) => {
      const l = byId.get(b.listingId)
      const isPublic = l && l.status === 'published' && !l.deleted_at
      return {
        listingId: b.listingId,
        name: l?.name ?? 'A business on the list',
        category: l?.categories?.name ?? null,
        href: isPublic ? buildEntityUrl(l.entity_type, l.cities?.slug, l.slug) : null,
        amountCents: b.amountCents,
      }
    })
  }

  // The Collective isn't open yet (ticket 122): drop its two stats and swap its
  // panel for the opening-soon note. Receipts already submitted stay put.
  const collectiveSoon = isCovered('collective')

  const allStats: Array<{ value: string; label: string; href: string; gold?: boolean; cta?: string }> = [
    { value: savedCount === null ? '–' : String(savedCount), label: 'Saved places', href: '/account/saved' },
    {
      value: reviewsCount === null ? '–' : String(reviewsCount),
      label: 'Reviews written',
      href: '/account/reviews',
    },
    {
      value: spend ? String(spend.approvedReceiptCount) : '–',
      label: 'Receipts approved',
      href: '/account/receipts',
    },
    {
      value: spend ? formatDollars(spend.totalCents) : '–',
      label: 'Spent, approved receipts only',
      href: spend && spend.totalCents === 0 ? '/account/receipts/new' : '/account/spending',
      gold: true,
      cta: spend && spend.totalCents === 0 ? 'Track a receipt' : undefined,
    },
  ]
  const stats = collectiveSoon ? allStats.slice(0, 2) : allStats

  return (
    <main className="max-w-[960px] flex flex-col gap-12">
      {/* 1-3. Greeting, attention, stats */}
      <section
        aria-labelledby="account-greeting"
        className="rounded-[4px] bg-deep-bg px-5 pt-8 pb-7 md:px-11 md:pt-11 md:pb-10 text-off-white"
      >
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-gold">
          Your account
        </p>
        <h1
          id="account-greeting"
          className="mt-3 font-headline font-medium text-[clamp(34px,4vw,52px)] leading-[1.05] tracking-[-0.01em] text-balance"
        >
          {displayName ? `Welcome back, ${displayName}.` : 'Welcome back.'}
        </h1>

        {latestClaimRes.error ? (
          <SectionError onDark className="mt-5" />
        ) : (
          pendingClaim && (
            <div
              role="region"
              aria-label="Needs your attention"
              className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[3px] border border-[#3a3632] px-4 py-3.5"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
                <circle cx="9" cy="9" r="8" fill="none" stroke="#c4a065" />
                <circle cx="9" cy="9" r="3.5" fill="#c4a065" />
              </svg>
              <div className="flex-1 min-w-[200px]">
                <p className="font-subhead text-[15px] font-semibold text-off-white">
                  Your claim{pendingClaim.listings ? ` for ${pendingClaim.listings.name}` : ''} is in
                  review.
                </p>
                <p className="font-subhead text-sm text-ink-soft">
                  We&apos;ll email you as soon as it&apos;s decided.
                </p>
              </div>
              <Link
                href="/account/claims"
                className="inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-light-gold underline underline-offset-2 hover:text-off-white"
              >
                View claim
              </Link>
            </div>
          )
        )}

        <dl
          className={`mt-8 grid grid-cols-2 border-t border-[#2a2a2d] ${stats.length === 4 ? 'lg:grid-cols-4' : ''}`}
        >
          {stats.map((stat, i) => (
            // Value above label on screen; dt stays first in the markup.
            <div
              key={stat.label}
              className={`flex flex-col-reverse justify-end gap-1 pt-5 pr-4 border-[#2a2a2d] ${STAT_DIVIDERS[i]}`}
            >
              <dt className="font-subhead text-[13px] text-ink-soft">{stat.label}</dt>
              <dd className="m-0">
                <Link
                  href={stat.href}
                  className={`inline-flex min-h-[44px] items-center font-headline text-[30px] md:text-[36px] leading-none hover:underline underline-offset-4 ${
                    stat.gold ? 'text-light-gold' : 'text-off-white'
                  }`}
                >
                  {stat.value}
                  <span className="sr-only">, {stat.label}</span>
                </Link>
                {stat.cta && (
                  <Link
                    href={stat.href}
                    className="block font-subhead text-[13px] font-semibold text-light-gold underline underline-offset-2"
                  >
                    {stat.cta}
                  </Link>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 4. Your place in The Collective */}
      {collectiveSoon ? (
        <CollectiveSoonPanel />
      ) : spend === null || listingsError ? (
        <section aria-label="Your place in The Collective">
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber mb-2">
            Your place in The Collective
          </p>
          <SectionError />
        </section>
      ) : (
        <CollectivePanel summary={spend} businesses={collectiveBusinesses} />
      )}

      {/* 5. Recently saved */}
      <section aria-labelledby="recent-saved-heading">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 id="recent-saved-heading" className="font-headline font-medium text-[26px] text-ink">
            Recently saved
          </h2>
          {savedCount !== null && savedCount > 0 && (
            <Link
              href="/account/saved"
              className="inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-amber underline underline-offset-2 hover:text-brand-black"
            >
              All saved ({savedCount})
            </Link>
          )}
        </div>

        {savesRes.error ? (
          <SectionError />
        ) : recentSaves.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 list-none m-0 p-0">
            {recentSaves.map((listing) => {
              const trust = trustLine(listing.trustTier, listing.ownershipLabel)
              const earned = listing.trustTier === 'verified' || listing.trustTier === 'certified'
              return (
                <li key={listing.id}>
                  <Link
                    href={buildEntityUrl(listing.entityType, listing.citySlug, listing.slug)}
                    className="group block"
                  >
                    <div className="relative aspect-[3/2] overflow-hidden rounded-[3px] bg-deep-bg">
                      {listing.coverSrc ? (
                        <Image
                          src={listing.coverSrc}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, 300px"
                          className="object-cover"
                        />
                      ) : (
                        <ImageFallback
                          name={listing.name}
                          categoryName={listing.categoryName}
                          seed={listing.id}
                          size="card"
                        />
                      )}
                    </div>
                    <p className="mt-3 font-headline text-[19px] text-ink truncate group-hover:underline underline-offset-2">
                      {listing.name}
                    </p>
                    <p className="font-subhead text-sm text-charcoal truncate">
                      {[listing.categoryName, listing.cityName].filter(Boolean).join(' · ')}
                    </p>
                    {trust && (
                      <p className="mt-1 flex items-center gap-1.5 font-subhead text-xs font-semibold text-ink">
                        {earned && (
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-amber" />
                        )}
                        {trust}
                      </p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="border-t border-hairline pt-5">
            <p className="font-body text-base text-charcoal">
              Save places you want to try. They&apos;ll show up here.
            </p>
            <Link
              href="/discover"
              className="inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-amber underline underline-offset-2 hover:text-brand-black"
            >
              Discover businesses
            </Link>
          </div>
        )}
      </section>

      {/* 6. Activity and contributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <section aria-labelledby="activity-rows-heading">
          <h2 id="activity-rows-heading" className="font-headline font-medium text-[22px] text-ink mb-3">
            Your activity
          </h2>
          <ul className="list-none m-0 p-0 border-b border-hairline">
            <RowLink
              href="/account/saved"
              label="All saved"
              meta={savedCount ? String(savedCount) : null}
            />
            <RowLink href="/account/activity" label="Recently viewed" />
            <RowLink href="/account/recommended" label="Recommended" />
          </ul>
        </section>

        <section aria-labelledby="contrib-rows-heading">
          <h2 id="contrib-rows-heading" className="font-headline font-medium text-[22px] text-ink mb-3">
            Your contributions
          </h2>
          <ul className="list-none m-0 p-0 border-b border-hairline">
            <RowLink
              href="/account/claims"
              label="My claims"
              meta={pendingClaim ? '1 pending' : latestClaim ? latestClaim.status : null}
              metaStrong={Boolean(pendingClaim)}
            />
            <RowLink
              href="/account/reviews"
              label="My reviews"
              meta={reviewsCount ? `${reviewsCount} published` : null}
            />
            <RowLink
              href="/account/receipts"
              label="My receipts"
              meta={
                collectiveSoon
                  ? 'Opening soon'
                  : spend && spend.pendingReceiptCount > 0
                  ? `${spend.pendingReceiptCount} pending`
                    : receiptsCount
                      ? String(receiptsCount)
                      : null
              }
              metaStrong={!collectiveSoon && Boolean(spend && spend.pendingReceiptCount > 0)}
            />
            <RowLink
              href="/account/community-spend"
              label="The Collective"
              meta={collectiveSoon ? 'Opening soon' : null}
            />
          </ul>
        </section>
      </div>

      {/* 7. Claim prompt, or the owner's page */}
      {ownedRes.error ? (
        <SectionError />
      ) : ownedListing ? (
        <section
          aria-labelledby="business-heading"
          className="rounded-[4px] bg-deep-bg px-5 py-7 md:px-11 md:py-9 flex flex-wrap items-center gap-6"
        >
          <div className="min-w-0 flex-[1_1_280px]">
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Your business
            </p>
            <h2
              id="business-heading"
              className="mt-2 font-headline font-medium text-[26px] md:text-[30px] text-off-white"
            >
              {ownedListing.name}
            </h2>
            <p className="mt-1 font-subhead text-sm text-ink-soft">
              {TRUST_TIER_META[ownedListing.trust_tier as TrustTier]?.label ?? ownedListing.trust_tier}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href={buildEntityUrl(ownedListing.entity_type, ownedListing.cities?.slug, ownedListing.slug)}
              className="inline-flex min-h-[46px] items-center justify-center px-[22px] rounded-[3px] border border-charcoal text-off-white font-subhead text-[15px] font-semibold hover:bg-off-white/10 transition-colors duration-150"
            >
              View page
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex min-h-[46px] items-center justify-center px-[22px] rounded-[3px] bg-gold hover:bg-light-gold text-brand-black font-subhead text-[15px] font-semibold transition-colors duration-150"
            >
              Manage my page
            </Link>
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="claim-heading"
          className="rounded-[4px] bg-deep-bg px-5 py-7 md:px-11 md:py-9 flex flex-wrap items-center gap-6"
        >
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Own a business?
            </p>
            <h2
              id="claim-heading"
              className="mt-2 font-headline font-medium text-[26px] md:text-[30px] text-off-white"
            >
              Claim your page. It&apos;s free.
            </h2>
            <p className="mt-2 font-body text-base leading-relaxed text-ink-soft max-w-[52ch]">
              Keep your hours and story right, answer reviews, and see who finds you.
            </p>
          </div>
          <Link
            href="/claim"
            className="inline-flex w-full sm:w-auto min-h-[46px] items-center justify-center px-[22px] rounded-[3px] bg-gold hover:bg-light-gold text-brand-black font-subhead text-[15px] font-semibold transition-colors duration-150"
          >
            Claim your business
          </Link>
        </section>
      )}

      {/* 8. Footer */}
      <div className="pt-4 border-t border-hairline flex items-center gap-6">
        <Link
          href="/account/settings"
          className="inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-charcoal hover:text-brand-black underline underline-offset-2"
        >
          Settings
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-red-800 hover:text-red-900 underline underline-offset-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
