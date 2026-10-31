import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ExternalLink, CheckCircle, Circle, Clock, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { aiQuota, canAccess } from '@/lib/stripe/features'
import { buildEntityUrl } from '@/lib/listings/url'
import { GetListedEmptyState } from '@/components/dashboard/GetListedEmptyState'
import { GoldBrandMark } from '@/components/ui/gold-brand-mark'
import { PostJobCard } from '@/components/dashboard/PostJobCard'
import { jobQuotaFor } from '@/lib/stripe/jobPostings'
import { postJobQuotaLine } from '@/lib/listings/jobEntryPoints'
import { loadOpenClaims, resolvePostingReadiness } from '@/lib/jobs/postingReadiness'
import { FreeMonthNotice } from './FreeMonthNotice'

function CompletenessItem({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {done ? (
        <CheckCircle className="size-4 text-green-500 shrink-0" aria-hidden="true" />
      ) : (
        <Circle className="size-4 text-charcoal/25 shrink-0" aria-hidden="true" />
      )}
      <span
        className={`font-body text-sm ${done ? 'text-charcoal-soft line-through' : 'text-charcoal'}`}
      >
        {label}
      </span>
    </li>
  )
}

// Ticket 146: owners see AI writing help first. Shown only while
// FEATURE_AI_BETA is on and the page's plan includes drafts; the allowance
// itself is read and enforced on Edit content, not here.
function WriteWithAi({
  listingId,
  listingName,
  quota,
}: {
  listingId: string
  listingName: string
  quota: number | null
}) {
  return (
    <div className="px-5 py-4 border-b border-charcoal/8 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <GoldBrandMark className="size-5 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="font-subhead text-sm font-semibold text-brand-black">Write with AI</h3>
          <p className="font-body text-sm text-charcoal mt-0.5">
            Get a draft of your about text, search title and summary, or an Instagram caption,
            written from your page.
            {quota !== null && ` Your plan includes ${quota} drafts every 30 days.`}
          </p>
        </div>
      </div>
      <Link
        href={`/dashboard/pages/${listingId}/edit`}
        aria-label={`Open the writer for ${listingName}`}
        className="sm:ml-auto shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-full border border-charcoal/20 bg-white text-brand-black font-subhead text-sm font-semibold hover:bg-off-white transition-colors"
      >
        Open the writer <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

export default async function DashboardPage() {
  const owner = await getOwnerSession()
  if (!owner) redirect('/sign-in?next=/dashboard')
  const supabase = await createClient()

  const { data: listings } = await supabase
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
    .order('created_at', { ascending: true })

  const aiOn = isFeatureEnabled('aiBeta')

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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Dashboard</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">
          Manage your BLACQList business pages.
        </p>
      </div>

      <FreeMonthNotice />

      <PostJobCard readiness={postingReadiness} quotaLine={postJobLine} />

      {!listings || listings.length === 0 ? (
        <GetListedEmptyState />
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => {
            const details = listing.listing_details_business as {
              description: string | null
              phone: string | null
              website_url: string | null
              cta_type: string | null
            } | null

            const city = listing.cities as { slug: string; name: string } | null
            const publicUrl = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

            const completeness = [
              // Cover leads the list deliberately: it is the one field that
              // changes how the business appears everywhere else on the site,
              // and the scored version of this check lives in Edit content's
              // Starter+ writing help, so free-tier owners only ever see it here.
              { done: !!listing.cover_image_path, label: 'Cover photo' },
              { done: !!listing.tagline, label: 'Tagline' },
              { done: !!details?.description, label: 'Business description' },
              { done: !!details?.phone || !!details?.website_url, label: 'Contact info' },
              { done: !!details?.cta_type, label: 'Call to action' },
              { done: !!listing.meta_title, label: 'SEO title' },
            ]
            const doneCount = completeness.filter((c) => c.done).length
            const quota = aiQuota(listing.tier)
            const showAi =
              aiOn && canAccess(listing.tier, 'ai_suggestions') && (quota === null || quota > 0)

            return (
              <div key={listing.id} className="rounded-xl border border-charcoal/10 bg-white">
                {/* Header */}
                <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-headline text-lg text-brand-black">{listing.name}</h2>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${
                          listing.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : listing.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-charcoal/10 text-charcoal-soft'
                        }`}
                      >
                        {listing.status}
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-subhead text-xs ${
                          listing.trust_tier === 'claimed' || listing.trust_tier === 'verified'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-charcoal/8 text-charcoal-soft'
                        }`}
                      >
                        {listing.trust_tier}
                      </span>
                    </div>
                    {listing.last_edited_by_owner_at && (
                      <p className="font-body text-xs text-charcoal-faint mt-0.5 flex items-center gap-1">
                        <Clock className="size-3" aria-hidden="true" />
                        Last saved {new Date(listing.last_edited_by_owner_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {publicUrl && (
                    <Link
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-subhead text-charcoal-soft hover:text-brand-black transition-colors"
                    >
                      View page <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>

                {showAi && <WriteWithAi listingId={listing.id} listingName={listing.name} quota={quota} />}

                {/* Completeness checklist */}
                <div className="px-5 py-4">
                  <p className="font-subhead text-xs font-semibold text-charcoal-soft mb-2 uppercase tracking-wide">
                    Profile completeness: {doneCount}/{completeness.length}
                  </p>
                  <ul className="space-y-1.5 mb-4">
                    {completeness.map(({ done, label }) => (
                      <CompletenessItem key={label} done={done} label={label} />
                    ))}
                  </ul>
                  <Link
                    href={`/dashboard/pages/${listing.id}/edit`}
                    aria-label={`Edit page for ${listing.name}`}
                    className="inline-flex items-center gap-1.5 font-subhead text-sm font-semibold text-amber hover:underline"
                  >
                    Edit page <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
