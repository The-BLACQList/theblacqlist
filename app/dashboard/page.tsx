import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { buildEntityUrl } from '@/lib/listings/url'
import { GetListedEmptyState } from '@/components/dashboard/GetListedEmptyState'
import { PostJobCard } from '@/components/dashboard/PostJobCard'
import { jobQuotaFor } from '@/lib/stripe/jobPostings'
import { postJobQuotaLine } from '@/lib/listings/jobEntryPoints'
import { loadOpenClaims, resolvePostingReadiness } from '@/lib/jobs/postingReadiness'
import { FreeMonthNotice } from './FreeMonthNotice'
import { PlanStrip } from '@/components/dashboard/PlanStrip'
import { getOwnerPlan } from '@/lib/services/billing/ownerPlan'
import { PAGE_COOKIE, pickPageId } from '@/lib/account/shellNav'
import { getUnreadMessageCount } from '@/lib/messaging/loaders'
import { countReceiptsToVerify } from '@/lib/dashboard/receiptsToVerify'
import { getWritingAllowance } from '@/lib/ai/allowance'
import { needsYouItems, pageChecklist } from '@/lib/dashboard/home'
import { countReviewsToAnswer, loadHomeSnapshot } from '@/lib/dashboard/homeData'
import { BusinessHeader } from '@/components/dashboard/home/BusinessHeader'
import { NeedsYou } from '@/components/dashboard/home/NeedsYou'
import { LockedSnapshot, Snapshot } from '@/components/dashboard/home/Snapshot'
import { FinishYourPage } from '@/components/dashboard/home/FinishYourPage'
import { QuickActions } from '@/components/dashboard/home/QuickActions'
import { WriteWithAi } from '@/components/dashboard/home/WriteWithAi'
import { ExplainNumbers } from './pages/[entityId]/analytics/_components/ExplainNumbers'

// Business Home (ticket 253). The founder, 2026-11-21: "The home page feels
// useless since I'm switching between pages in the left panel. Make it more
// useful to a business owner at first glance." Home is now about the one page
// picked in the menu (same choice as the rail: cookie, else newest) and
// answers what needs me, how am I doing, and what to do next.
export default async function DashboardPage() {
  const owner = await getOwnerSession()
  if (!owner) redirect('/sign-in?next=/dashboard')
  const supabase = await createClient()

  // Newest first, the same order the menu's page switcher uses.
  const [{ data: listings }, jar] = await Promise.all([
    supabase
      .from('listings')
      .select(
        `
      id, name, slug, status, entity_type, tier, trust_tier, tagline, meta_title, cover_image_path,
      last_edited_by_owner_at, published_at,
      cities(slug, name),
      listing_details_business(description, phone, website_url, cta_type)
    `
      )
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    cookies(),
  ])

  // Tickets 154 and 156: the Post a job card shows the owner's step until a
  // business page is live. Claims and the quota are read only when the card can
  // show; a failed quota read drops the count, not the card.
  const postingOn = isFeatureEnabled('jobsOpen') && isFeatureEnabled('postingSubmissions')
  const postingReadiness = postingOn
    ? resolvePostingReadiness(listings ?? [], await loadOpenClaims(supabase, owner.user.id))
    : null
  const quotaRead =
    postingReadiness?.state === 'live' ? await jobQuotaFor(supabase, owner.user.id) : null
  const postJobLine = postJobQuotaLine(quotaRead?.ok ? quotaRead.value : null)

  if (!listings || listings.length === 0) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="font-headline text-2xl text-brand-black">My Business</h1>
        <FreeMonthNotice />
        <PostJobCard readiness={postingReadiness} quotaLine={postJobLine} />
        <GetListedEmptyState />
      </div>
    )
  }

  const pageId =
    pickPageId(
      '/dashboard',
      listings.map((l) => ({ id: l.id, name: l.name, tier: l.tier })),
      jar.get(PAGE_COOKIE)?.value
    ) ?? listings[0]!.id
  const listing = listings.find((l) => l.id === pageId) ?? listings[0]!
  const others = listings.length - 1

  const details = listing.listing_details_business as {
    description: string | null
    phone: string | null
    website_url: string | null
    cta_type: string | null
  } | null
  const city = listing.cities as { slug: string; name: string } | null
  const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

  const hasNumbers = canAccess(listing.tier, 'analytics')
  const messagingOn = isFeatureEnabled('messaging')
  const receiptsOn = isFeatureEnabled('ownerReceiptReview')
  const quota = aiQuota(listing.tier)
  const showAi =
    isFeatureEnabled('aiBeta') &&
    canAccess(listing.tier, 'ai_suggestions') &&
    (quota === null || quota > 0)

  // Ticket 237: the owner's plan. Free pages read no analytics at all.
  const [ownerPlan, snapshot, reviewsToAnswer, messagesUnread, receiptsToVerify, allowance] =
    await Promise.all([
      getOwnerPlan(supabase, owner.user.id, listings),
      hasNumbers ? loadHomeSnapshot(supabase, listing.id) : Promise.resolve(null),
      listing.status === 'published'
        ? countReviewsToAnswer(supabase, listing.id)
        : Promise.resolve(0),
      messagingOn ? getUnreadMessageCount(supabase) : Promise.resolve(undefined),
      receiptsOn ? countReceiptsToVerify(owner.user.id, [listing.id]) : Promise.resolve(undefined),
      hasNumbers ? getWritingAllowance(listing.id, listing.tier) : Promise.resolve(null),
    ])

  const needs = needsYouItems({
    pageId: listing.id,
    messagesUnread,
    receiptsToVerify,
    reviewsToAnswer,
    publicUrl,
    status: listing.status,
  })
  const checklist = pageChecklist({
    cover: !!listing.cover_image_path,
    tagline: !!listing.tagline,
    description: !!details?.description,
    contact: !!details?.phone || !!details?.website_url,
    cta: !!details?.cta_type,
    seoTitle: !!listing.meta_title,
  })

  return (
    <div className="max-w-4xl space-y-6" data-testid="business-home" data-page-id={listing.id}>
      <BusinessHeader
        pageId={listing.id}
        name={listing.name}
        status={listing.status}
        tier={listing.tier}
        publicUrl={publicUrl}
      />

      <FreeMonthNotice />

      <NeedsYou items={needs} />

      {snapshot ? (
        <Snapshot snapshot={snapshot} insightsHref={`/dashboard/pages/${listing.id}/analytics`} />
      ) : (
        <LockedSnapshot />
      )}

      {allowance?.state === 'ready' && (
        <ExplainNumbers listingId={listing.id} allowance={allowance} />
      )}

      <FinishYourPage pageId={listing.id} items={checklist} />

      <QuickActions pageId={listing.id} posts={isFeatureEnabled('happeningNow')} />

      {showAi && <WriteWithAi listingId={listing.id} listingName={listing.name} quota={quota} />}

      <PostJobCard readiness={postingReadiness} quotaLine={postJobLine} />

      {ownerPlan && <PlanStrip plan={ownerPlan} />}

      {others > 0 && (
        <p className="font-body text-sm text-charcoal-soft" data-testid="home-other-pages">
          You have {others} other {others === 1 ? 'page' : 'pages'}. Switch pages from the menu, or
          see{' '}
          <Link
            href="/dashboard/pages"
            className="font-semibold text-amber underline-offset-2 hover:underline"
          >
            All My Pages
          </Link>
          .
        </p>
      )}
    </div>
  )
}
