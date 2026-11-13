'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ArrowRight, Info, Radio } from 'lucide-react'
import type { FinishData } from '@/lib/listings/finishData'
import { computePageChecklist } from '@/lib/ai/checklist'
import { creatorChecklistFacts } from '@/lib/listings/creatorAttributes'
import { socialLinksAllowed, upgradeTarget, type UpgradeTarget } from '@/lib/stripe/planChecks'
import { TIER_RANK, attributeLimit, descriptionCharLimit, faqLimit, photoLimit } from '@/lib/stripe/features'
import { getCtaLabel, type CTAType } from '@/types'
import { LivePagePreview } from '@/components/listings/LivePagePreview'
import { extraButtonLabel, shownExtraButtons } from '@/lib/listings/pageButtons'
import { BasicInfoSection } from '@/components/dashboard/BasicInfoSection'
import { AboutSection } from '@/components/dashboard/AboutSection'
import { MediaGrid } from '@/components/dashboard/MediaGrid'
import { CtaSection } from '@/components/dashboard/CtaSection'
import { ContactSection } from '@/components/dashboard/ContactSection'
import { HoursSection } from '@/components/dashboard/HoursSection'
import { OfferingsList } from '@/components/dashboard/OfferingsList'
import { AddOfferingForm } from '@/components/dashboard/AddOfferingForm'
import { AttributesSection } from '@/components/dashboard/AttributesSection'
import { LevelSection } from '@/components/dashboard/LevelSection'
import { PartnershipSection } from '@/components/dashboard/PartnershipSection'
import { CollectiveNameSection } from '@/components/dashboard/CollectiveNameSection'
import { SocialSection } from '@/components/dashboard/SocialSection'
import { VideoSection } from '@/components/dashboard/VideoSection'
import { LinksSection } from '@/components/dashboard/LinksSection'
import { FaqSection } from '@/components/dashboard/FaqSection'
import { HiddenContentNotice } from '@/components/dashboard/HiddenContentNotice'
import { hiddenContent } from '@/lib/listings/hiddenContent'
import { offersGrowth } from '@/lib/stripe/downgrade'
import { PublishSection } from '@/components/dashboard/PublishSection'
import { SaveLabelProvider } from '@/components/dashboard/SaveLabel'
import { StrengthMeter, itemLabel } from './finish/StrengthMeter'
import { GoogleCard } from './finish/GoogleCard'
import { FinishSubmit } from './finish/FinishSubmit'
import { ProfileSaveProvider, SaveBar } from './finish/ProfileSave'
import { CaptionHelp, WritingHelpProvider, WritingHelpStrip } from './finish/WritingHelp'
import { CLOSING_NOTE, type InitialSuggestions, type WritingAllowance } from '@/lib/ai/writingHelp'
import type { TextField } from '@/lib/ai/onboardingCards'
import { OnboardingDrafts } from './finish/OnboardingDrafts'
import { EditTabs, panelId, tabId } from './finish/EditTabs'
import { MoreBelow } from './finish/MoreBelow'
import { SiteImport, type ImportSaved } from './finish/SiteImport'
import { photoRoom, previewContact, type ImportCard, type PageNow } from '@/lib/import/ownerImport'
import { MAX_PHOTO_CANDIDATES } from '@/lib/import/limits'
import type { WeeklyHours } from '@/types'
import { HappeningNowCard } from '@/components/dashboard/HappeningNowCard'
import type { OwnerPost } from '@/lib/listings/happeningNow'
import {
  DEFAULT_TAB,
  EDIT_TABS,
  nextTab,
  SCROLL_ORDER,
  TAB_SECTIONS,
  tabForAnchor,
  type EditTabId,
} from '@/lib/listings/editTabs'

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
  /** Writing help in the fields (ticket 138). Left out on a new page. */
  writingHelp?: { allowance: WritingAllowance; initial: InitialSuggestions }
  /** Drafts after "Save my draft" (ticket 128). Only on a new page with the flag on. */
  onboardingDrafts?: { autoStart: boolean; aboutFromSite: boolean }
  /** Growth can be bought right now (ticket 143). Left out, it reads as closed. */
  growthOpen?: boolean
  /** Premium can be bought and this is a Growth page. Only the extra buttons note offers it. */
  premiumOpen?: boolean
  /** The page's inbox switch, shown with the main button. Edit mode with messaging on only. */
  inbox?: { open: boolean }
  /** The tab to open first on the edit page, from `?tab=`. A `#card` in the address wins. */
  initialTab?: EditTabId
  /** Happening now posts (part F). Edit mode on a business page with the flag on only. */
  happeningNow?: { posts: OwnerPost[]; now: string }
}

// Which section shows each draft card's field, and that field's draft key.
const CARD_TARGET: Record<TextField, { section: 'basics' | 'about' | 'google'; key: keyof Draft }> =
  {
    tagline: { section: 'basics', key: 'tagline' },
    about: { section: 'about', key: 'description' },
    searchTitle: { section: 'google', key: 'meta_title' },
    searchDescription: { section: 'google', key: 'meta_description' },
  }

type Draft = {
  name: string
  tagline: string
  description: string
  meta_title: string
  meta_description: string
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

type Mounts = { basics: number; about: number; google: number; contact: number; hours: number; social: number }

function bumpCards(m: Mounts, cards: readonly ImportCard[]): Mounts {
  const next = { ...m }
  for (const c of cards) next[c] += 1
  return next
}

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    // tabIndex -1 lets the strength bars move focus here (see goToSection).
    <div id={id} tabIndex={-1} className="scroll-mt-32 md:scroll-mt-36 rounded-xl outline-none transition-shadow">
      {children}
    </div>
  )
}

export function PageFinishView({
  data,
  mode,
  warning = null,
  storageUrl,
  writingHelp,
  onboardingDrafts,
  growthOpen = false,
  premiumOpen = false,
  inbox,
  initialTab = DEFAULT_TAB,
  happeningNow,
}: Props) {
  const d = data.details
  const fromProps: Draft = {
    name: data.name,
    tagline: data.tagline ?? '',
    description: d?.description ?? '',
    meta_title: data.metaTitle ?? '',
    meta_description: data.metaDescription ?? '',
  }
  // A field saved from a draft card bridges the moment until the page's props
  // catch up (the save revalidates this page). Once the prop moves, it wins.
  const [applied, setApplied] = useState<
    Partial<Record<keyof Draft, { value: string; before: string }>>
  >({})
  // The sections read their props once, so a saved draft card remounts the
  // section that shows it.
  const [mounts, setMounts] = useState<Mounts>({ basics: 0, about: 0, google: 0, contact: 0, hours: 0, social: 0 })
  const saved = { ...fromProps }
  for (const key of Object.keys(applied) as (keyof Draft)[]) {
    const a = applied[key]
    if (a && fromProps[key] === a.before) saved[key] = a.value
  }
  const [draft, setDraft] = useState<Draft>(saved)
  const patchDraft = (patch: Partial<Draft>) => setDraft((cur) => ({ ...cur, ...patch }))

  function onDraftApplied(field: TextField, value: string) {
    const { section, key } = CARD_TARGET[field]
    const nextSaved = { ...saved, [key]: value }
    setApplied((cur) => ({ ...cur, [key]: { value, before: fromProps[key] } }))
    setMounts((m) => ({ ...m, [section]: m[section] + 1 }))
    // The remounted section starts from what is saved, so its other unsaved
    // edits go back to saved too.
    const sectionKeys: Record<typeof section, (keyof Draft)[]> = {
      basics: ['name', 'tagline'],
      about: ['description'],
      google: ['meta_title', 'meta_description'],
    }
    setDraft((cur) => {
      const next = { ...cur }
      for (const k of sectionKeys[section]) next[k] = nextSaved[k]
      return next
    })
  }

  // "Import from my website" (part C). The cards read their props once, so
  // the ones an import saved to remount when the refreshed page arrives with
  // what was saved. Until then the preview shows the new name and About, the
  // same bridge a draft card uses.
  const [importWaiting, setImportWaiting] = useState<ImportCard[]>([])
  const [seenData, setSeenData] = useState(data)
  if (seenData !== data) {
    setSeenData(data)
    if (importWaiting.length > 0) {
      setMounts((m) => bumpCards(m, importWaiting))
      // The remounted Basics card starts from what is saved, tagline included.
      if (importWaiting.includes('basics')) setDraft((cur) => ({ ...cur, tagline: saved.tagline }))
      setImportWaiting([])
    }
  }

  function onImported({ cards, name, description }: ImportSaved) {
    const values: Partial<Draft> = {}
    if (name !== undefined) values.name = name
    if (description !== undefined) values.description = description
    setApplied((cur) => {
      const next = { ...cur }
      for (const [k, v] of Object.entries(values) as [keyof Draft, string][]) {
        next[k] = { value: v, before: fromProps[k] }
      }
      return next
    })
    setDraft((cur) => ({ ...cur, ...values }))
    setImportWaiting((cur) => [...new Set([...cur, ...cards])])
  }

  const rootRef = useRef<HTMLDivElement>(null)

  const tier = data.tier
  // About and social links are Starter features, so only a Free page is offered
  // an upgrade there. The count limits (details, video, questions) also offer
  // Growth to a Starter page while Growth is for sale (ticket 143).
  const starterOffer: UpgradeTarget = (TIER_RANK[tier ?? 'free'] ?? 0) === 0 ? 'Starter' : null
  const moreOffer = upgradeTarget(tier, growthOpen)
  const buttonsOffer = upgradeTarget(tier, growthOpen, premiumOpen)
  // Extra buttons save on their own; the editor reports each change so the
  // preview and the hidden-content line follow along.
  const [buttons, setButtons] = useState(data.buttons)
  // Ticket 105: what the public page leaves out after a move to a lower plan.
  // Uses the saved description, the same text the page shows.
  const hidden = hiddenContent({
    tier,
    peakTier: data.peakTier,
    description: d?.description ?? null,
    media: data.media,
    videos: data.videos,
    faqs: data.faqs,
    attributeGroups: data.attributeGroups,
    selectedValueIds: data.selectedValueIds,
    buttons,
  })

  const checklist = computePageChecklist(
    {
      tagline: draft.tagline || null,
      meta_title: draft.meta_title || null,
      meta_description: draft.meta_description || null,
      cover_image_path: data.coverImagePath,
      entity_type: data.entityType,
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
    extraLabels: shownExtraButtons(buttons, tier).shown.map(extraButtonLabel),
    coverUrl: data.coverUrl,
  }

  const isNewDraft = data.status === 'draft' && data.trustTier === 'unclaimed'
  const isLive = data.status === 'published'
  const layout = LAYOUT[mode]
  const asideLabel = mode === 'new' ? 'Your page so far' : 'Your page'

  const importNow: PageNow = {
    name: data.name,
    description: d?.description ?? null,
    phone: d?.phone ?? null,
    email: d?.email ?? null,
    websiteUrl: d?.website_url ?? null,
    addressLine1: d?.address_line_1 ?? null,
    state: d?.state ?? null,
    zip: d?.zip ?? null,
    hours: (d?.hours as WeeklyHours | null | undefined) ?? null,
    socials: {
      instagram: d?.social_instagram ?? null,
      facebook: d?.social_facebook ?? null,
      twitter: d?.social_twitter ?? null,
      tiktok: d?.social_tiktok ?? null,
      linkedin: d?.social_linkedin ?? null,
      youtube: d?.social_youtube ?? null,
    },
    locationLabel: data.locationLabel,
  }

  // What the edit page's preview adds below About (part C feedback): the
  // photos the page shows and its contact details, so an import is visible
  // here as soon as it saves. Rebuilt from `data` on each refresh.
  const previewExtras =
    mode === 'edit'
      ? {
          photoUrls: data.media
            .filter((m) => m.is_approved === true && !hidden.hiddenIds.has(m.id))
            .slice(0, 4)
            .map((m) => `${storageUrl}/listing-media/${m.file_path}`),
          contact: previewContact(importNow, data.entityType !== 'creator'),
        }
      : {}

  const helpReady = writingHelp?.allowance.state === 'ready'
  const initial = writingHelp?.initial ?? {}

  // Edit page tabs (part C).
  const [tab, setTab] = useState<EditTabId>(initialTab)
  const tabsTopRef = useRef<HTMLDivElement>(null)
  function selectTab(next: EditTabId) {
    setTab(next)
    // Keep the open tab in the address, so a reload or a shared link comes back to it.
    const url = new URL(window.location.href)
    url.searchParams.set('tab', next)
    url.hash = ''
    window.history.replaceState(window.history.state, '', url)
    // From deep in a long tab, start the next one at its top.
    const top = tabsTopRef.current
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' })
  }
  // Opens the tab a card is in, before the strength meter or a failed save
  // moves focus there. flushSync, so the card is visible by the next line.
  const showSection = useCallback((anchorId: string) => {
    const next = tabForAnchor(anchorId)
    if (next) flushSync(() => setTab(next))
  }, [])
  // A link to a card (`/edit#hours`) opens its tab. The server can't see the
  // hash, so this runs once the page is up, and again if the hash changes.
  useEffect(() => {
    if (mode !== 'edit') return
    function openFromHash() {
      const id = window.location.hash.slice(1)
      const next = tabForAnchor(id)
      if (!next) return
      setTab(next)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
      )
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [mode])
  const reveal = mode === 'edit' ? showSection : undefined

  // Every card, by anchor id. A new page shows them in one scroll; the edit
  // page groups them into tabs (part C). Cards a page doesn't have are left out.
  const sections: Partial<Record<string, ReactNode>> = {
    'happening-now':
      mode === 'edit' && happeningNow ? (
        <HappeningNowCard
          listingId={data.id}
          posts={happeningNow.posts}
          tier={tier}
          upgradeTo={moreOffer}
          now={happeningNow.now}
        />
      ) : null,
    basics: (
      <BasicInfoSection
        key={`basics-${mounts.basics}`}
        listingId={data.id}
        name={data.name}
        tagline={saved.tagline || null}
        onDraftChange={patchDraft}
      />
    ),
    about: (
      <AboutSection
        key={`about-${mounts.about}`}
        listingId={data.id}
        description={saved.description || null}
        charLimit={descriptionCharLimit(tier)}
        upgradeTo={starterOffer}
        onDraftChange={patchDraft}
        initialSuggestion={initial.listing_description}
      />
    ),
    contact: (
      <ContactSection
        key={`contact-${mounts.contact}`}
        listingId={data.id}
        phone={d?.phone ?? null}
        email={d?.email ?? null}
        websiteUrl={d?.website_url ?? null}
        addressLine1={d?.address_line_1 ?? null}
        addressLine2={d?.address_line_2 ?? null}
        state={d?.state ?? null}
        zip={d?.zip ?? null}
      />
    ),
    hours:
      data.entityType !== 'creator' ? (
        <HoursSection key={`hours-${mounts.hours}`} listingId={data.id} hours={d?.hours ?? null} />
      ) : null,
    photos: (
      <MediaGrid
        media={data.media}
        supabaseStorageUrl={storageUrl}
        listingId={data.id}
        coverImagePath={data.coverImagePath}
        hiddenIds={hidden.hiddenIds}
      />
    ),
    'main-button': (
      <CtaSection
        listingId={data.id}
        ctaType={d?.cta_type ?? null}
        ctaUrl={d?.cta_url ?? null}
        ctaLabelOverride={d?.cta_label_override ?? null}
        inbox={inbox}
        extras={{
          initial: data.buttons,
          tier,
          upgradeTo: buttonsOffer,
          hasPhone: !!d?.phone,
          onChange: setButtons,
        }}
      />
    ),
    services: (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-charcoal/10 bg-white">
          <div className="border-b border-charcoal/8 px-5 py-4">
            <h2 className="font-headline text-base text-brand-black">Services and offerings</h2>
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
    ),
    role:
      data.levels && data.levels.allowed.length > 1 ? (
        <LevelSection
          listingId={data.id}
          primary={data.levels.primary}
          extras={data.levels.extras}
          allowed={data.levels.allowed}
        />
      ) : null,
    details: (
      <AttributesSection
        listingId={data.id}
        groups={data.attributeGroups}
        selectedValueIds={data.selectedValueIds}
        limit={attributeLimit(tier)}
        upgradeTo={moreOffer}
        entityType={data.entityType}
      />
    ),
    partnerships: (
      <PartnershipSection
        listingId={data.id}
        entityType={data.entityType}
        openToPartnerships={data.openToPartnerships}
      />
    ),
    'collective-name':
      data.entityType !== 'job' ? (
        <CollectiveNameSection listingId={data.id} optedIn={data.collectiveNameOptIn} />
      ) : null,
    social: (
      <SocialSection
        key={`social-${mounts.social}`}
        listingId={data.id}
        socialInstagram={d?.social_instagram ?? null}
        socialFacebook={d?.social_facebook ?? null}
        socialLinkedin={d?.social_linkedin ?? null}
        socialTiktok={d?.social_tiktok ?? null}
        socialYoutube={d?.social_youtube ?? null}
        socialTwitter={d?.social_twitter ?? null}
        locked={!socialLinksAllowed(tier, data.entityType)}
        hiddenOnPage={!data.socialsShowOnPage}
        upgradeTo={starterOffer}
        caption={helpReady ? <CaptionHelp initial={initial.social_caption_instagram} /> : undefined}
      />
    ),
    video: (
      <VideoSection
        listingId={data.id}
        videos={data.videos}
        tier={tier}
        hiddenIds={hidden.hiddenIds}
        storageUrl={storageUrl}
        upgradeTo={moreOffer}
      />
    ),
    links: <LinksSection listingId={data.id} links={data.links} />,
    faq: (
      <FaqSection
        listingId={data.id}
        faqs={data.faqs}
        limit={faqLimit(tier)}
        upgradeTo={moreOffer}
        hiddenIds={hidden.hiddenIds}
      />
    ),
    google: (
      <GoogleCard
        key={`google-${mounts.google}`}
        listingId={data.id}
        publicUrl={data.publicUrl}
        seoFields={{
          name: preview.name,
          tagline: preview.tagline || null,
          description: preview.description || null,
          categoryName: data.categoryName,
          locationLabel: data.locationLabel,
        }}
        metaTitle={saved.meta_title || null}
        metaDescription={saved.meta_description || null}
        onDraftChange={patchDraft}
        initial={initial}
      />
    ),
  }
  const cards = (ids: readonly string[]) =>
    ids.map((id) =>
      sections[id] ? (
        <Anchor key={id} id={id}>
          {sections[id]}
        </Anchor>
      ) : null
    )

  const body =
    mode === 'edit' ? (
      <div ref={tabsTopRef} className="flex scroll-mt-16 flex-col gap-6 md:scroll-mt-20">
        <EditTabs active={tab} onSelect={selectTab} />
        {EDIT_TABS.map((t) => (
          // Every panel stays mounted, so edits in a closed tab are kept and
          // "Save all" still finds them.
          <div
            key={t.id}
            role="tabpanel"
            id={panelId(t.id)}
            aria-labelledby={tabId(t.id)}
            hidden={t.id !== tab}
            className="flex flex-col gap-6"
          >
            {cards(TAB_SECTIONS[t.id])}
            {nextTab(t.id) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const next = nextTab(t.id)
                    if (next) selectTab(next.id)
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60"
                >
                  Next: {nextTab(t.id)?.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ))}
        <MoreBelow watch={tab} />
      </div>
    ) : (
      <>
        {cards(SCROLL_ORDER)}
        <MoreBelow />
      </>
    )


  const view = (
    <SaveLabelProvider live={isLive}>
      <ProfileSaveProvider live={isLive} rootRef={rootRef} reveal={reveal}>
        <div ref={rootRef} className={layout.grid}>
          <div className="flex min-w-0 flex-col gap-6">
            {isLive && (
              <div className="flex gap-3 rounded-xl border border-charcoal/10 bg-white px-4 py-3">
                <Radio className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
                <p className="font-body text-sm leading-relaxed text-brand-black">
                  Your page is live. Changes go on your public page when you tap Publish changes.
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
                  <span className="font-semibold">{data.categoryName ?? 'a close category'}</span>{' '}
                  for now. Our team will look at the new category you asked for and email you either
                  way.
                </p>
              </div>
            )}

            <HiddenContentNotice
              counts={hidden.counts}
              offerGrowth={offersGrowth(tier, growthOpen)}
            />

            <div className={layout.topPreview}>
              <LivePagePreview {...preview} compact />
            </div>

            <StrengthMeter checklist={checklist} showSection={reveal} />

            {onboardingDrafts && (
              <OnboardingDrafts
                listingId={data.id}
                autoStart={onboardingDrafts.autoStart}
                aboutFromSite={onboardingDrafts.aboutFromSite}
                aboutLimit={descriptionCharLimit(tier)}
                onApplied={onDraftApplied}
              />
            )}

            {writingHelp && <WritingHelpStrip />}

            {mode === 'edit' && (
              <SiteImport
                listingId={data.id}
                now={importNow}
                options={{
                  aboutLimit: descriptionCharLimit(tier),
                  socialsAllowed: socialLinksAllowed(tier, data.entityType),
                  hasHours: data.entityType !== 'creator',
                }}
                hasCover={data.coverImagePath !== null}
                photoRoom={photoRoom(photoLimit(tier), data.media.length, MAX_PHOTO_CANDIDATES)}
                photoPlan={{
                  limit: photoLimit(tier),
                  upgradeTo: moreOffer,
                  nextLimit: moreOffer ? photoLimit(moreOffer.toLowerCase()) : null,
                }}
                aboutLocked={writingHelp?.allowance.state === 'locked'}
                onSaved={onImported}
              />
            )}

            {body}

            <SaveBar />

            {isNewDraft ? (
              <FinishSubmit listingId={data.id} name={data.name} missing={missing} />
            ) : (
              <PublishSection
                listingId={data.id}
                status={data.status}
                trustTier={data.trustTier}
                entityType={data.entityType}
              />
            )}

            {helpReady && (
              <p className="font-body text-xs leading-relaxed text-charcoal-soft">{CLOSING_NOTE}</p>
            )}
          </div>

          <aside className={layout.aside} aria-label={asideLabel}>
            <div className="sticky top-24 flex flex-col gap-3">
              <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft">
                {asideLabel}
              </p>
              <LivePagePreview {...preview} {...previewExtras} />
            </div>
          </aside>
        </div>
      </ProfileSaveProvider>
    </SaveLabelProvider>
  )

  return writingHelp ? (
    <WritingHelpProvider listingId={data.id} allowance={writingHelp.allowance}>
      {view}
    </WritingHelpProvider>
  ) : (
    view
  )
}
