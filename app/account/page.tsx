import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { ChevronRight, FileCheck } from 'lucide-react'
import type { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { resolveCoverImage } from '@/lib/listings/coverImage'
import { ImageFallback } from '@/components/media/ImageFallback'

export const metadata: Metadata = { title: 'My Account | The BLACQList' }

interface RecentSave {
  id: string
  name: string
  slug: string
  entityType: string
  categoryName: string | null
  citySlug: string | undefined
  cityName: string | null
  coverSrc: string | null
}

export default async function AccountOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in?next=/account')

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split('@')[0] ?? 'there'

  const [savesRes, savedCountRes, reviewsCountRes, latestClaimRes, spendRes, ownedRes] =
    await Promise.all([
      supabase
        .from('saves')
        .select(
          'id, listings!inner(id, name, slug, entity_type, cover_image_path, status, deleted_at, categories(name), cities!listings_city_id_fkey(name, slug))'
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
      supabase
        .from('receipt_uploads')
        .select('amount_cents, status')
        .eq('user_id', user.id)
        .neq('status', 'rejected'),
      supabase
        .from('listings')
        .select('id, name, slug, entity_type, trust_tier, cover_image_path, cities!listings_city_id_fkey(slug)')
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
    }
  })

  const savedCount = savedCountRes.count ?? 0
  const reviewsCount = reviewsCountRes.count ?? 0
  const latestClaim = latestClaimRes.data as
    | { id: string; status: string; listings: { name: string } | null }
    | null
  const spendCents = (spendRes.data ?? []).reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  const ownedListing = ownedRes.data as
    | {
        id: string
        name: string
        slug: string
        entity_type: string
        trust_tier: string
        cover_image_path: string | null
        cities: { slug: string } | null
      }
    | null

  const stats: Array<{ value: string; label: string; href: string }> = [
    { value: String(savedCount), label: 'Saved', href: '/account/saved' },
    { value: String(reviewsCount), label: 'Reviews', href: '/account/reviews' },
    ...(latestClaim
      ? [{ value: '1', label: `Claim · ${latestClaim.status}`, href: '/account/claims' }]
      : []),
    ...(spendCents > 0
      ? [
          {
            value: `$${Math.round(spendCents / 100).toLocaleString()}`,
            label: 'Spend tracked',
            href: '/account/community-spend',
          },
        ]
      : []),
  ]

  // Account shell content-measure convention: list/overview pages max-w-[960px],
  // form/detail pages max-w-[640px] (see saved/ vs settings/).
  return (
    <main className="max-w-[960px]">
      <h1 className="font-headline text-[26px] md:text-[32px] text-brand-black mb-5">
        Welcome back, {displayName}
      </h1>

      {/* Stat strip */}
      {stats.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-3 mb-8 ${
            stats.length === 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : ''
          }`}
        >
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-xl border border-charcoal/10 px-4 py-3 hover:shadow-md transition-shadow duration-150"
            >
              <span className="block font-headline text-[23px] text-brand-black">{stat.value}</span>
              <span className="font-subhead text-[11.5px] font-semibold text-charcoal-soft">
                {stat.label}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Recently saved */}
      <section aria-labelledby="recent-saved-heading" className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            id="recent-saved-heading"
            className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber"
          >
            Recently saved
          </h2>
          {savedCount > 3 && (
            <Link
              href="/account/saved"
              className="font-subhead text-xs font-semibold text-charcoal hover:text-brand-black"
            >
              View all {savedCount} →
            </Link>
          )}
        </div>

        {recentSaves.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentSaves.map((listing) => (
              <Link
                key={listing.id}
                href={buildEntityUrl(listing.entityType, listing.citySlug, listing.slug)}
                className="group bg-white rounded-xl border border-charcoal/10 overflow-hidden hover:shadow-md transition-shadow duration-150"
              >
                <div className="relative aspect-[3/2] bg-deep-bg">
                  {listing.coverSrc ? (
                    <Image
                      src={listing.coverSrc}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 240px"
                      className="object-cover"
                    />
                  ) : (
                    <ImageFallback
                      name={listing.name}
                      categoryName={listing.categoryName}
                      size="card"
                    />
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-headline text-sm text-brand-black truncate group-hover:underline underline-offset-2">
                    {listing.name}
                  </p>
                  <p className="font-subhead text-[11px] text-charcoal-soft truncate">
                    {[listing.categoryName, listing.cityName].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-charcoal/10 p-6 text-center">
            <p className="font-body text-sm text-charcoal mb-2">
              You haven&apos;t saved any businesses yet.
            </p>
            <Link
              href="/discover"
              className="font-subhead text-sm font-bold text-amber hover:text-brand-black underline underline-offset-2"
            >
              Start exploring →
            </Link>
          </div>
        )}
      </section>

      {/* Needs your attention */}
      {latestClaim && latestClaim.status === 'pending' && (
        <section aria-labelledby="attention-heading" className="mb-8">
          <h2
            id="attention-heading"
            className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-3"
          >
            Needs your attention
          </h2>
          <Link
            href="/account/claims"
            className="flex items-center gap-3 rounded-xl border border-light-gold/60 bg-[#fdf9ef] px-4 py-3.5 hover:shadow-md transition-shadow duration-150"
          >
            <FileCheck className="size-5 text-amber shrink-0" aria-hidden="true" />
            <span className="font-subhead text-sm font-semibold text-brand-black flex-1 min-w-0">
              Your claim{latestClaim.listings ? ` on ${latestClaim.listings.name}` : ''} is pending
              review
            </span>
            <ChevronRight className="size-4 text-charcoal-faint shrink-0" aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Role-aware business block */}
      {ownedListing ? (
        <section
          aria-labelledby="business-heading"
          className="rounded-xl bg-deep-bg p-5 md:p-6 flex items-center gap-4 flex-wrap"
        >
          <div className="min-w-0 flex-1">
            <h2 id="business-heading" className="font-headline text-[17px] text-white">
              {ownedListing.name}
            </h2>
            <p className="font-subhead text-xs text-off-white/70 mt-0.5 capitalize">
              {ownedListing.trust_tier} · your business page
            </p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <Link
              href={buildEntityUrl(
                ownedListing.entity_type,
                ownedListing.cities?.slug,
                ownedListing.slug
              )}
              className="inline-flex items-center justify-center h-10 px-5 rounded-full border border-off-white/40 text-white font-subhead text-sm font-bold hover:bg-off-white/10 transition-colors duration-150"
            >
              View page
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150"
            >
              Manage my page
            </Link>
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="claim-heading"
          className="rounded-xl bg-deep-bg p-5 md:p-6 flex items-center gap-4 flex-wrap"
        >
          <div className="min-w-0 flex-1">
            <h2 id="claim-heading" className="font-headline text-[17px] text-white">
              Own a business?
            </h2>
            <p className="font-subhead text-xs text-off-white/70 mt-0.5">
              Claim your page and get your official home on The BLACQList.
            </p>
          </div>
          <Link
            href="/for-business"
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-gold hover:bg-light-gold text-brand-black font-subhead text-sm font-bold transition-colors duration-150"
          >
            Claim your business
          </Link>
        </section>
      )}
    </main>
  )
}
