import { notFound } from 'next/navigation'
import { CheckCircle2, XCircle, Sparkles, Lock } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { canAccess } from '@/lib/stripe/features'
import {
  computePageChecklist,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ChecklistCategory,
} from '@/lib/ai/checklist'

interface Props {
  params: Promise<{ entityId: string }>
}

function ScoreBadge({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = Math.round((score / maxScore) * 100)
  const colorClass =
    pct >= 80
      ? 'bg-green-100 text-green-700 border-green-200'
      : pct >= 50
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200'
  const label = pct >= 80 ? 'Strong' : pct >= 50 ? 'Good — keep improving' : 'Needs work'

  return (
    <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-xl border ${colorClass}`}>
      <span className="font-headline text-3xl">{score}</span>
      <div>
        <p className="font-subhead text-xs font-semibold uppercase tracking-wide opacity-60">
          out of {maxScore}
        </p>
        <p className="font-subhead text-sm font-semibold">{label}</p>
      </div>
    </div>
  )
}

export default async function AiSuggestionsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select(
      `
      id, name, tier, tagline, meta_title, meta_description,
      listing_details_business(
        description, phone, website_url,
        social_instagram, social_facebook, social_tiktok,
        social_youtube, social_twitter, social_linkedin,
        cta_type
      )
    `
    )
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()

  if (!canAccess(listing.tier, 'ai_suggestions')) {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">AI Suggestions</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
        </div>
        <div className="rounded-xl border border-charcoal/10 bg-white px-8 py-12 text-center">
          <Lock className="size-10 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
          <h2 className="font-headline text-xl text-brand-black mb-2">
            AI Suggestions is a paid feature
          </h2>
          <p className="font-body text-sm text-charcoal-soft max-w-sm mx-auto mb-6">
            Upgrade to Starter or above to unlock your page optimization score, AI-generated copy
            suggestions, and SEO recommendations.
          </p>
          <Link
            href="/dashboard/upgrade"
            className="inline-flex items-center justify-center h-10 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors"
          >
            View upgrade options
          </Link>
        </div>
      </div>
    )
  }

  const details = listing.listing_details_business as {
    description: string | null
    phone: string | null
    website_url: string | null
    social_instagram: string | null
    social_facebook: string | null
    social_tiktok: string | null
    social_youtube: string | null
    social_twitter: string | null
    social_linkedin: string | null
    cta_type: string | null
  } | null

  const [mediaResult, serviceResult, hoursResult, suggestionsResult] = await Promise.all([
    supabase
      .from('media_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', entityId)
      .eq('entity_type', 'listing'),

    supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', entityId)
      .is('deleted_at', null),

    supabase
      .from('listing_hours')
      .select('id', { count: 'exact', head: true })
      .eq('listing_id', entityId),

    supabase
      .from('ai_suggestions')
      .select('id, suggestion_type, agent_type, suggestion_text, status, created_at')
      .eq('listing_id', entityId)
      .in('status', ['pending', 'approved', 'applied'])
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const mediaCount = mediaResult.count ?? 0
  const serviceCount = serviceResult.count ?? 0
  const hoursCount = hoursResult.count ?? 0
  const suggestions = suggestionsResult.data ?? []

  const checklist = computePageChecklist(
    {
      tagline: listing.tagline,
      meta_title: listing.meta_title,
      meta_description: listing.meta_description,
    },
    details,
    mediaCount,
    serviceCount,
    hoursCount
  )

  const groupedItems = CATEGORY_ORDER.reduce<Record<ChecklistCategory, typeof checklist.items>>(
    (acc, cat) => {
      acc[cat] = checklist.items.filter((i) => i.category === cat)
      return acc
    },
    { required: [], recommended: [], seo: [], engagement: [] }
  )

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl text-brand-black">AI Suggestions</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
      </div>

      {/* Page Optimization Checklist */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
            Page optimization score
          </h2>
        </div>

        <ScoreBadge score={checklist.score} maxScore={checklist.maxScore} />

        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          {CATEGORY_ORDER.map((cat, catIdx) => {
            const items = groupedItems[cat]
            return (
              <div key={cat} className={catIdx > 0 ? 'border-t border-charcoal/5' : undefined}>
                <div className="px-5 py-2.5 bg-pale-lavender/30">
                  <p className="font-subhead text-[11px] font-semibold text-charcoal-soft uppercase tracking-wide">
                    {CATEGORY_LABELS[cat]}
                  </p>
                </div>
                <ul className="divide-y divide-charcoal/5">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                      {item.passed ? (
                        <CheckCircle2
                          className="size-4 text-green-500 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <XCircle
                          className="size-4 text-charcoal/25 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0">
                        <p
                          className={`font-body text-sm ${
                            item.passed ? 'text-brand-black' : 'text-charcoal-soft'
                          }`}
                        >
                          {item.label}
                        </p>
                        {!item.passed && (
                          <p className="font-body text-xs text-charcoal-faint mt-0.5">{item.hint}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Suggestions section */}
      <div className="space-y-4">
        <h2 className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
          AI-generated suggestions
        </h2>

        {suggestions.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
            <Sparkles className="size-10 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
            <p className="font-body text-sm text-charcoal-soft">AI copy suggestions coming in V2.</p>
            <p className="font-body text-xs text-charcoal-faint mt-1">
              Once available, AI-generated suggestions for your description, SEO copy, and social
              captions will appear here — ready for your review and approval before anything is
              published.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-charcoal/10 bg-white divide-y divide-charcoal/5">
            {suggestions.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-charcoal-soft">{s.suggestion_type}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-subhead text-[11px] font-semibold ${
                      s.status === 'applied'
                        ? 'bg-green-100 text-green-700'
                        : s.status === 'approved'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="font-body text-sm text-brand-black">{s.suggestion_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval note */}
      <div className="rounded-xl border border-charcoal/10 bg-pale-lavender/20 px-5 py-4">
        <p className="font-subhead text-xs font-semibold text-charcoal-soft mb-1">
          How AI suggestions work
        </p>
        <p className="font-body text-xs text-charcoal-soft leading-relaxed">
          All AI-generated suggestions require your review and approval before anything is published
          to your page. You stay in control — nothing changes without you explicitly applying it.
        </p>
      </div>
    </div>
  )
}
