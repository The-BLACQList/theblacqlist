'use client'

import { useMemo, useRef, useState } from 'react'
import { Info, Radio } from 'lucide-react'
import type { FinishData } from '@/lib/listings/finishData'
import { computePageChecklist } from '@/lib/ai/checklist'
import { creatorChecklistFacts } from '@/lib/listings/creatorAttributes'
import {
  TIER_RANK,
  attributeLimit,
  canAccess,
  descriptionCharLimit,
  faqLimit,
} from '@/lib/stripe/features'
import { getCtaLabel, type CTAType } from '@/types'
import { LivePagePreview } from '@/components/listings/LivePagePreview'
import { BasicInfoSection } from '@/components/dashboard/BasicInfoSection'
import { AboutSection } from '@/components/dashboard/AboutSection'
import { MediaGrid } from '@/components/dashboard/MediaGrid'
import { CtaSection } from '@/components/dashboard/CtaSection'
import { ContactSection } from '@/components/dashboard/ContactSection'
import { HoursSection } from '@/components/dashboard/HoursSection'
import { OfferingsList } from '@/components/dashboard/OfferingsList'
import { AddOfferingForm } from '@/components/dashboard/AddOfferingForm'
import { AttributesSection } from '@/components/dashboard/AttributesSection'
import { PartnershipSection } from '@/components/dashboard/PartnershipSection'
import { SocialSection } from '@/components/dashboard/SocialSection'
import { VideoSection } from '@/components/dashboard/VideoSection'
import { LinksSection } from '@/components/dashboard/LinksSection'
import { FaqSection } from '@/components/dashboard/FaqSection'
import { PublishSection } from '@/components/dashboard/PublishSection'
import { SaveLabelProvider } from '@/components/dashboard/SaveLabel'
import { StrengthMeter, itemLabel } from './finish/StrengthMeter'
import { GoogleCard } from './finish/GoogleCard'
import { FinishSubmit } from './finish/FinishSubmit'
import { useLeaveGuard } from './finish/useLeaveGuard'

// The side-by-side finish view: every section of a business page on the left,
// the page itself on the right. One component for both mounts (tickets 126 and
// 129) so a new page and an owner edit always look and work the same.

interface Props {
  data: FinishData
  mode: 'new' | 'edit'
  /** 'request': the owner asked for a new category, so the page sits in a fallback one. */
  warning?: 'request' | null
  /** Public storage base, `${SUPABASE_URL}/storage/v1/object/public`. */
  storageUrl: string
}

type Draft = { name: string; tagline: string; description: string }

const DRAFT_LABELS: Record<keyof Draft, string> = {
  name: 'business name',
  tagline: 'tagline',
  description: 'about',
}

// The owner edit page sits beside the dashboard sidebar, so it has less room
// and goes side by side one breakpoint later. Full class strings so Tailwind
// keeps them.
const LAYOUT = {
  new: {
    grid: 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10',
    topPreview: 'lg:hidden',
    aside: 'hidden lg:block',
  },
  edit: {
    grid: 'grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-10',
    topPreview: 'xl:hidden',
    aside: 'hidden xl:block',
  },
} as const

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      {children}
    </div>
  )
}

export function PageFinishView({ data, mode, warning = null, storageUrl }: Props) {
  const d = data.details
  const saved: Draft = {
    name: data.name,
    tagline: data.tagline ?? '',
    description: d?.description ?? '',
  }
  const [draft, setDraft] = useState<Draft>(saved)
  const patchDraft = (patch: Partial<Draft>) => setDraft((cur) => ({ ...cur, ...patch }))

  const unsaved = useMemo(() => {
    const out: Partial<Draft> = {}
    for (const key of Object.keys(saved) as (keyof Draft)[]) {
      if (draft[key] !== saved[key]) out[key] = draft[key]
    }
    return out
    // `saved` is rebuilt from props each render; its fields are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved.name, saved.tagline, saved.description])
  const unsavedKeys = Object.keys(unsaved) as (keyof Draft)[]

  const rootRef = useRef<HTMLDivElement>(null)
  useLeaveGuard(rootRef, unsavedKeys.length > 0)

  const tier = data.tier
  const showUpgrade = (TIER_RANK[tier ?? 'free'] ?? 0) === 0

  const checklist = computePageChecklist(
    {
      tagline: draft.tagline || null,
      meta_title: data.metaTitle,
      meta_description: data.metaDescription,
      cover_image_path: data.coverImagePath,
    },
    d ? { ...d, description: draft.description || null } : null,
    data.media.length,
    data.services.length,
    data.hoursCount,
    tier ?? undefined,
    data.entityType === 'creator' ? creatorChecklistFacts(data) : null
  )
  const missing = checklist.items.filter((i) => !i.passed).map((i) => itemLabel(i.id, i.label))

  const ctaLabel = d?.cta_type ? getCtaLabel(d.cta_type as CTAType, d.cta_label_override) : null
  const preview = {
    name: draft.name || data.name,
    tagline: draft.tagline,
    description: draft.description,
    categoryName: data.categoryName,
    locationLabel: data.locationLabel,
    ownershipLabel: data.ownershipLabel,
    ctaLabel,
    coverUrl: data.coverUrl,
  }

  const isNewDraft = data.status === 'draft' && data.trustTier === 'unclaimed'
  const isLive = data.status === 'published'
  const layout = LAYOUT[mode]
  const asideLabel = mode === 'new' ? 'Your page so far' : 'Your page'

  return (
    <SaveLabelProvider live={isLive}>
      <div ref={rootRef} className={layout.grid}>
        <div className="flex min-w-0 flex-col gap-6">
          {isLive && (
            <div className="flex gap-3 rounded-xl border border-charcoal/10 bg-white px-4 py-3">
              <Radio className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
              <p className="font-body text-sm leading-relaxed text-brand-black">
                Your page is live. Each save puts that change on your public page right away.
              </p>
            </div>
          )}

          {warning === 'request' && (
            <div
              role="status"
              className="flex gap-3 rounded-xl border border-amber-gold/40 bg-amber-gold/10 px-4 py-3"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
              <p className="font-body text-sm leading-relaxed text-brand-black">
                Your page is saved under{' '}
                <span className="font-semibold">{data.categoryName ?? 'a close category'}</span> for
                now. Our team will look at the new category you asked for and email you either way.
              </p>
            </div>
          )}

          <div className={layout.topPreview}>
            <LivePagePreview {...preview} compact />
          </div>

          <StrengthMeter checklist={checklist} />

          <Anchor id="basics">
            <BasicInfoSection
              listingId={data.id}
              name={data.name}
              tagline={data.tagline}
              onDraftChange={patchDraft}
            />
          </Anchor>

          <Anchor id="about">
            <AboutSection
              listingId={data.id}
              description={d?.description ?? null}
              charLimit={descriptionCharLimit(tier)}
              showUpgrade={showUpgrade}
              onDraftChange={patchDraft}
            />
          </Anchor>

          {unsavedKeys.length > 0 && (
            <p aria-live="polite" className="-mt-3 font-body text-xs text-amber">
              Not saved yet: {unsavedKeys.map((k) => DRAFT_LABELS[k]).join(', ')}.
            </p>
          )}

          <Anchor id="photos">
            <MediaGrid
              media={data.media}
              supabaseStorageUrl={storageUrl}
              listingId={data.id}
              coverImagePath={data.coverImagePath}
            />
          </Anchor>

          <Anchor id="main-button">
            <CtaSection
              listingId={data.id}
              ctaType={d?.cta_type ?? null}
              ctaUrl={d?.cta_url ?? null}
              ctaLabelOverride={d?.cta_label_override ?? null}
            />
          </Anchor>

          <Anchor id="contact">
            <ContactSection
              listingId={data.id}
              phone={d?.phone ?? null}
              email={d?.email ?? null}
              websiteUrl={d?.website_url ?? null}
              addressLine1={d?.address_line_1 ?? null}
              addressLine2={d?.address_line_2 ?? null}
              state={d?.state ?? null}
              zip={d?.zip ?? null}
            />
          </Anchor>

          {data.entityType !== 'creator' && (
            <Anchor id="hours">
              <HoursSection listingId={data.id} hours={d?.hours ?? null} />
            </Anchor>
          )}

          <Anchor id="services">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-charcoal/10 bg-white">
                <div className="border-b border-charcoal/8 px-5 py-4">
                  <h2 className="font-headline text-base text-brand-black">
                    Services and offerings
                  </h2>
                  <p className="mt-0.5 font-body text-xs text-charcoal-soft">
                    What you offer: services, products, or classes.
                  </p>
                </div>
                <div className="px-5 py-4">
                  <OfferingsList services={data.services} />
                </div>
              </div>
              <AddOfferingForm listingId={data.id} />
            </div>
          </Anchor>

          <Anchor id="details">
            <AttributesSection
              listingId={data.id}
              groups={data.attributeGroups}
              selectedValueIds={data.selectedValueIds}
              limit={attributeLimit(tier)}
              showUpgrade={showUpgrade}
              entityType={data.entityType}
            />
          </Anchor>

          <Anchor id="partnerships">
            <PartnershipSection
              listingId={data.id}
              entityType={data.entityType}
              openToPartnerships={data.openToPartnerships}
            />
          </Anchor>

          <Anchor id="social">
            <SocialSection
              listingId={data.id}
              socialInstagram={d?.social_instagram ?? null}
              socialFacebook={d?.social_facebook ?? null}
              socialLinkedin={d?.social_linkedin ?? null}
              socialTiktok={d?.social_tiktok ?? null}
              socialYoutube={d?.social_youtube ?? null}
              socialTwitter={d?.social_twitter ?? null}
              locked={!canAccess(tier, 'social_links')}
              showUpgrade={showUpgrade}
            />
          </Anchor>

          <Anchor id="video">
            <VideoSection
              listingId={data.id}
              videoEmbedUrl={data.videoEmbedUrl}
              videoPath={data.videoPath}
              storageUrl={storageUrl}
              locked={!canAccess(tier, 'listing_video')}
              showUpgrade={showUpgrade}
            />
          </Anchor>

          <LinksSection listingId={data.id} links={data.links} />

          <FaqSection
            listingId={data.id}
            faqs={data.faqs}
            limit={faqLimit(tier)}
            showUpgrade={showUpgrade}
          />

          <Anchor id="google">
            <GoogleCard
              listingId={data.id}
              publicUrl={data.publicUrl}
              seoFields={{
                name: preview.name,
                tagline: preview.tagline || null,
                description: preview.description || null,
                categoryName: data.categoryName,
                locationLabel: data.locationLabel,
              }}
              metaTitle={data.metaTitle}
              metaDescription={data.metaDescription}
              description={d?.description ?? null}
            />
          </Anchor>

          {isNewDraft ? (
            <FinishSubmit
              listingId={data.id}
              name={data.name}
              missing={missing}
              unsaved={unsaved}
            />
          ) : (
            <PublishSection
              listingId={data.id}
              status={data.status}
              trustTier={data.trustTier}
              entityType={data.entityType}
            />
          )}
        </div>

        <aside className={layout.aside} aria-label={asideLabel}>
          <div className="sticky top-24 flex flex-col gap-3">
            <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft">
              {asideLabel}
            </p>
            <LivePagePreview {...preview} />
          </div>
        </aside>
      </div>
    </SaveLabelProvider>
  )
}
