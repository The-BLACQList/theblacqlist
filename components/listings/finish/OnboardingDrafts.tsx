'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Info, PenLine } from 'lucide-react'
import {
  applyDraftCategoryAction,
  requestOnboardingDraftsAction,
  type OnboardingDraftsState,
} from '@/lib/actions/ai/onboardingDrafts'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import type { DraftFocus, DraftStyle } from '@/lib/ai/onboarding'
import {
  CARD_TITLES,
  SAVE_FIELD,
  SAVE_LIMIT,
  TEXT_FIELDS,
  cardValuesFrom,
  categoryUnchanged,
  mergeDrafts,
  type CardField,
  type CardValues,
  type TextField,
} from '@/lib/ai/onboardingCards'
import { DraftCard, IDLE_CARD, type CardStatus } from './DraftCard'
import { BTN_SECONDARY } from './WritingHelp'

// Drafts after "Save my draft" (ticket 128): a category, tagline, about and
// search text, each on its own card. Nothing is saved until the owner taps
// Use this, which goes through the same save as the sections below.

type Ready = Extract<OnboardingDraftsState, { ok: true }>

interface Props {
  listingId: string
  /** Arrived from "Save my draft": ask once on load. */
  autoStart: boolean
  /** The saved about came from the owner's site (see onboardingContextFrom). */
  aboutFromSite: boolean
  /** The plan's about limit, so Use this never fails on length. */
  aboutLimit: number | null
  /** A card was saved; the section that shows the field takes the new value. */
  onApplied: (field: TextField, value: string) => void
}

const INPUT =
  'w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const FAILED = "Couldn't save that. Try again."
const STATUSES = (): Record<CardField, CardStatus> => ({
  category: IDLE_CARD,
  tagline: IDLE_CARD,
  about: IDLE_CARD,
  searchTitle: IDLE_CARD,
  searchDescription: IDLE_CARD,
})

export function OnboardingDrafts({ listingId, autoStart, aboutFromSite, aboutLimit, onApplied }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  // The page drops ?from=site after the first ask; the first answer holds.
  const fromSite = useRef(aboutFromSite)
  const started = useRef(false)
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<Omit<Ready, 'drafts'> | null>(null)
  const [values, setValues] = useState<CardValues | null>(null)
  const [status, setStatus] = useState(STATUSES)
  const [error, setError] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const patchStatus = (field: CardField, patch: Partial<CardStatus>) =>
    setStatus((cur) => ({ ...cur, [field]: { ...cur[field], ...patch } }))

  async function ask(focus: DraftFocus, style: DraftStyle) {
    setError(null)
    if (focus === 'all') setLoading(true)
    else patchStatus(focus, { busy: 'asking', saved: null, error: null })
    let result: OnboardingDraftsState | null = null
    try {
      result = await requestOnboardingDraftsAction({
        listingId,
        style,
        focus,
        aboutFromSite: fromSite.current,
      })
    } catch {
      result = null
    }
    setLoading(false)
    if (focus !== 'all') patchStatus(focus, { busy: null })
    if (!result || !result.ok) {
      setError(result?.error ?? "Couldn't get drafts right now. Try again.")
      return
    }
    const { drafts, ...rest } = result
    setMeta(rest)
    setValues((cur) => (cur ? mergeDrafts(cur, drafts, focus) : cardValuesFrom(drafts)))
    if (focus === 'all') setStatus(STATUSES())
    setAnnounce(
      rest.fallbackLine ??
        (focus === 'all' ? 'Your drafts are ready.' : `A new ${CARD_TITLES[focus].toLowerCase()} is ready.`)
    )
  }

  useEffect(() => {
    if (!autoStart || started.current) return
    started.current = true
    void ask('all', 'fresh')
    // A reload should not ask again and use up a draft.
    const params = new URLSearchParams(window.location.search)
    params.delete('drafts')
    params.delete('from')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    // Runs once on arrival; `ask` reads only refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

  async function saveText(field: TextField) {
    if (!values) return
    const value = values[field].trim()
    patchStatus(field, { busy: 'saving', saved: null, error: null })
    const form = new FormData()
    form.set('listing_id', listingId)
    form.set(SAVE_FIELD[field], value)
    try {
      const result = await updateListingContentAction(null, form)
      if (result && 'success' in result) {
        patchStatus(field, { busy: null, saved: 'Saved to your page.' })
        onApplied(field, value)
        return
      }
      patchStatus(field, { busy: null, error: result && 'error' in result ? result.error : FAILED })
    } catch {
      patchStatus(field, { busy: null, error: FAILED })
    }
  }

  async function saveCategory() {
    const category = values?.category
    if (!category) return
    patchStatus('category', { busy: 'saving', saved: null, error: null })
    try {
      const result = await applyDraftCategoryAction({
        listingId,
        choice:
          category.kind === 'existing'
            ? { kind: 'existing', categoryId: category.categoryId }
            : { kind: 'new', name: category.name, groupId: category.groupId },
      })
      if (result.ok) {
        patchStatus('category', { busy: null, saved: result.message })
        if (category.kind === 'existing') setMeta((m) => (m ? { ...m, currentCategoryId: category.categoryId } : m))
      } else {
        patchStatus('category', { busy: null, error: result.error })
      }
    } catch {
      patchStatus('category', { busy: null, error: FAILED })
    }
  }

  const setText = (field: TextField, value: string) =>
    setValues((cur) => (cur ? { ...cur, [field]: value } : cur))

  return (
    <section
      aria-labelledby="drafts-heading"
      className="rounded-xl border border-charcoal/10 bg-white"
    >
      <div className="border-b border-charcoal/8 px-5 py-4">
        <h2 id="drafts-heading" className="font-headline text-base text-brand-black">
          Drafts for your page
        </h2>
        <p className="mt-0.5 font-body text-xs text-charcoal-soft">
          Change anything you like. Nothing is saved until you tap Use this.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <p role="status" className="sr-only">
          {loading ? 'Writing drafts for your page.' : announce}
        </p>

        {!values && !loading && (
          <button type="button" onClick={() => ask('all', 'fresh')} className={BTN_SECONDARY}>
            <PenLine className="size-4" aria-hidden="true" />
            Write drafts for me
          </button>
        )}

        {loading && (
          <div className="rounded-lg border border-charcoal/10 bg-white p-4" aria-hidden="true">
            <p className="font-body text-sm text-charcoal-soft">
              Writing drafts. You can keep editing below.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <div className="h-3 w-full animate-pulse rounded bg-charcoal/10" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-charcoal/10" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-charcoal/10" />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="font-body text-sm text-red-700">
            {error}
          </p>
        )}

        {meta?.fallbackLine && !loading && (
          <p className="flex gap-2 rounded-lg border border-charcoal/10 bg-charcoal/5 px-4 py-3 font-body text-sm text-charcoal">
            <Info className="mt-0.5 size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
            {meta.fallbackLine}
          </p>
        )}

        {values && meta && !loading && (
          <>
            {values.category && (
              <DraftCard
                title={CARD_TITLES.category}
                status={status.category}
                sample={meta.sample}
                restyle={false}
                capped={meta.capped}
                note={
                  categoryUnchanged(values.category, meta.currentCategoryId)
                    ? 'Your page is already in this category.'
                    : values.category.kind === 'new'
                      ? 'This is a new category idea. Our team looks at each one and emails you.'
                      : null
                }
                onUse={categoryUnchanged(values.category, meta.currentCategoryId) ? null : saveCategory}
                onAsk={(style) => ask('category', style)}
              >
                {(id) =>
                  values.category?.kind === 'new' ? (
                    <div className="flex flex-col gap-1">
                      <input
                        id={id}
                        type="text"
                        value={values.category.name}
                        maxLength={60}
                        onChange={(e) =>
                          setValues((cur) =>
                            cur?.category?.kind === 'new'
                              ? { ...cur, category: { ...cur.category, name: e.target.value } }
                              : cur
                          )
                        }
                        className={INPUT}
                      />
                      <p className="font-body text-xs text-charcoal-soft">
                        Your page sits under {values.category.groupName} until our team decides.
                      </p>
                    </div>
                  ) : (
                    <output id={id} className="block font-body text-sm text-brand-black">
                      {values.category?.name}
                    </output>
                  )
                }
              </DraftCard>
            )}

            {TEXT_FIELDS.map((field) =>
              values[field] ? (
                <DraftCard
                  key={field}
                  title={CARD_TITLES[field]}
                  status={status[field]}
                  sample={meta.sample}
                  restyle
                  capped={meta.capped}
                  onUse={() => saveText(field)}
                  onAsk={(style) => ask(field, style)}
                >
                  {(id) =>
                    field === 'about' ? (
                      <textarea
                        id={id}
                        value={values.about}
                        rows={5}
                        maxLength={aboutLimit ?? undefined}
                        onChange={(e) => setText('about', e.target.value)}
                        className={INPUT}
                      />
                    ) : (
                      <input
                        id={id}
                        type="text"
                        value={values[field]}
                        maxLength={SAVE_LIMIT[field]}
                        onChange={(e) => setText(field, e.target.value)}
                        className={INPUT}
                      />
                    )
                  }
                </DraftCard>
              ) : null
            )}
          </>
        )}
      </div>
    </section>
  )
}
