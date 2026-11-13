'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Globe, Loader2, Sparkles } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { readMySiteAction, importMySitePhotosAction } from '@/lib/actions/dashboard/siteImport'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'
import { rejectSuggestionAction } from '@/lib/actions/ai/rejectSuggestion'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { MAX_PHOTOS_PER_IMPORT } from '@/lib/import/limits'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'
import type { SiteFindings } from '@/lib/import/read-site'
import type { PhotoImportOutcome } from '@/lib/import/siteImportCore'
import {
  cardsFor,
  chunk,
  importRows,
  pairsFor,
  photoChoices,
  withAboutDraft,
  type ImportCard,
  type ImportOptions,
  type ImportRow,
  type PageNow,
} from '@/lib/import/ownerImport'
import { EDIT_TABS, tabForAnchor } from '@/lib/listings/editTabs'
import { useChangedCards, useProfileSave } from './ProfileSave'
import { useWritingHelp } from './WritingHelp'

// "Import from my website" on the owner edit page (part C, 2026-11-13). Reads
// the owner's site once, shows each finding beside what the page has now, and
// saves only what the owner ticks. A field that already has a value starts
// unticked. Photos come in only when picked, with the owner's say-so.

export interface ImportSaved {
  cards: ImportCard[]
  name?: string
  description?: string
}

interface Props {
  listingId: string
  now: PageNow
  options: ImportOptions
  hasCover: boolean
  /** Photos the plan has room for now. Picks are sent in batches of one import each. */
  photoRoom: number
  /** The plan's photo cap and the upgrade that raises it, for the "plan full" note. */
  photoPlan: { limit: number | null; upgradeTo: UpgradeTarget; nextLimit: number | null }
  /**
   * Writing an About from the site uses writing help, a Starter feature. True
   * when it is locked on this plan, so the sheet can say so instead.
   */
  aboutLocked: boolean
  /** After a save: which cards to refresh, and the new name and about for the preview. */
  onSaved: (saved: ImportSaved) => void
}

type Phase =
  | { kind: 'enter' }
  | { kind: 'review'; findings: SiteFindings; rows: ImportRow[] }
  | { kind: 'done'; saved: string[]; failedPhotos: PhotoImportOutcome[]; coverSet: boolean; error: string | null }

const PRIMARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-black px-4 font-subhead text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-charcoal/20 bg-white px-4 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5 disabled:opacity-50'

const CARD_NAMES: Record<ImportCard, string> = {
  basics: 'Name',
  about: 'About',
  contact: 'Contact',
  hours: 'Hours',
  social: 'Social links',
}

export function SiteImport(props: Props) {
  const [open, setOpen] = useState(false)
  // A fresh start each time the sheet opens.
  const [session, setSession] = useState(0)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charcoal/10 bg-white px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Globe className="mt-0.5 size-4 shrink-0 text-charcoal-soft" aria-hidden="true" />
        <p className="font-body text-sm leading-relaxed text-brand-black">
          Have a website? Bring in your details and photos, and pick what to keep.
        </p>
      </div>
      <button
        type="button"
        className={SECONDARY}
        onClick={() => {
          setSession((n) => n + 1)
          setOpen(true)
        }}
      >
        Import from my website
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <ImportFlow key={session} {...props} onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ImportFlow({
  listingId,
  now,
  options,
  hasCover,
  photoRoom,
  photoPlan,
  aboutLocked,
  onSaved,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter()
  const save = useProfileSave()
  const changedCards = useChangedCards()
  const help = useWritingHelp()
  const ids = useId()
  const [draft, setDraft] = useState<AboutDraft>({ kind: 'idle' })
  // The draft's suggestion while it is still unused, so closing the sheet or
  // asking for another records it as not used, the way the About card does.
  const openDraft = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (openDraft.current) void dropSuggestion(openDraft.current)
      openDraft.current = null
    },
    []
  )
  const [phase, setPhase] = useState<Phase>({ kind: 'enter' })
  const [url, setUrl] = useState(now.websiteUrl ?? '')
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [photos, setPhotos] = useState<string[]>([])
  const [cover, setCover] = useState<string | null>(null)
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const [rights, setRights] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function read(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await readMySiteAction({ listingId, url })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const rows = importRows(result.findings, now, options)
      setTicked(new Set(rows.filter((r) => r.defaultChecked).map((r) => r.key)))
      setPhotos([])
      setCover(null)
      setRights(false)
      if (openDraft.current) void dropSuggestion(openDraft.current)
      openDraft.current = null
      setDraft({ kind: 'idle' })
      setPhase({ kind: 'review', findings: result.findings, rows })
    })
  }

  function toggle(key: string, on: boolean) {
    setTicked((cur) => {
      const next = new Set(cur)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }

  if (phase.kind === 'enter') {
    return (
      <>
        <SheetHeader className="border-b border-charcoal/8 px-6 py-5">
          <SheetTitle className="font-headline text-xl text-brand-black">Import from my website</SheetTitle>
          <SheetDescription className="font-body text-sm text-charcoal-soft">
            We read your public page once, when you ask. Nothing changes on your page until you pick what to keep.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={read} className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label htmlFor={`${ids}-url`} className="mb-1 block font-subhead text-sm font-semibold text-brand-black">
              Your website
            </label>
            <input
              id={`${ids}-url`}
              type="text"
              inputMode="url"
              autoComplete="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="yourbusiness.com"
              aria-describedby={error ? `${ids}-error` : undefined}
              className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-base text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
            <p className="mt-1 font-body text-xs text-charcoal-soft">
              Your home page or About page works best. Link-in-bio pages work too.
            </p>
          </div>
          <ErrorLine id={`${ids}-error`} error={error} />
          <div>
            <button type="submit" className={PRIMARY} disabled={pending || !url.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {pending ? 'Reading your site…' : 'Read my site'}
            </button>
          </div>
        </form>
      </>
    )
  }

  if (phase.kind === 'done') {
    return (
      <>
        <SheetHeader className="border-b border-charcoal/8 px-6 py-5">
          <SheetTitle className="font-headline text-xl text-brand-black">
            {phase.saved.length > 0 ? 'Brought in' : 'Nothing came in'}
          </SheetTitle>
          <SheetDescription className="font-body text-sm text-charcoal-soft">
            {phase.saved.length > 0
              ? 'Saved to your page. Check each card and change anything you like.'
              : 'Your page hasn’t changed.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-6 py-5" role="status">
          {phase.saved.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {phase.saved.map((line) => (
                <li key={line} className="flex items-center gap-2 font-body text-sm text-brand-black">
                  <Check className="size-4 shrink-0 text-green-600" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          )}
          {phase.coverSet && (
            <p className="font-body text-sm text-brand-black">One of the photos is now your cover.</p>
          )}
          {phase.failedPhotos.length > 0 && (
            <div className="rounded-lg bg-amber-gold/10 px-3 py-2.5">
              <p className="font-subhead text-sm font-semibold text-brand-black">
                {phase.failedPhotos.length === 1 ? 'One photo didn’t come in' : `${phase.failedPhotos.length} photos didn’t come in`}
              </p>
              <ul className="mt-1 list-disc pl-5 font-body text-xs text-charcoal">
                {[...new Set(phase.failedPhotos.map((p) => (p.ok ? '' : p.message)))].filter(Boolean).map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-1 font-body text-xs text-charcoal-soft">You can upload them under Photos & video.</p>
            </div>
          )}
          <ErrorLine id={`${ids}-error`} error={phase.error} />
          <div>
            <button type="button" className={PRIMARY} onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </>
    )
  }

  const { findings } = phase
  const rows =
    draft.kind === 'ready' ? withAboutDraft(phase.rows, draft.text, now, options.aboutLimit) : phase.rows
  const siteText = (findings.siteText ?? findings.about ?? '').trim()
  // Writing help needs something to write from; a few words aren't enough.
  const canWrite = siteText.length >= 40
  const choices = photoChoices(findings).filter((p) => !broken.has(p.url))
  const sendPairs = pairsFor(rows, ticked)
  const cards = cardsFor(rows, ticked)
  // Ticked fields refresh their cards, which would drop what the owner typed there.
  const atRisk = cards.filter((c) => changedCards.includes(c))
  const nothingToSave = sendPairs.length === 0 && photos.length === 0
  const photosFull = photos.length >= photoRoom
  const roomShort = photoRoom < choices.length
  const draftUsed = draft.kind === 'ready' && ticked.has('about') && sendPairs.some(([k]) => k === 'description')

  function writeAbout() {
    if (!help || draft.kind === 'loading') return
    const previous = openDraft.current
    openDraft.current = null
    setDraft({ kind: 'loading' })
    void (async () => {
      if (previous) void dropSuggestion(previous)
      const result = await help.request('listing_description', { site_text: siteText })
      if (!result.ok) {
        setDraft({ kind: 'failed', message: result.message })
        return
      }
      openDraft.current = result.suggestion.id
      setDraft({ kind: 'ready', id: result.suggestion.id, text: result.suggestion.text, sample: result.suggestion.sample })
      toggle('about', true)
    })()
  }

  function apply() {
    setError(null)
    if (photos.length > 0 && !rights) {
      setError('Confirm you own these photos or have permission to use them.')
      document.getElementById(`${ids}-rights`)?.focus()
      return
    }
    startTransition(async () => {
      const saved: string[] = []
      let saveError: string | null = null

      if (sendPairs.length > 0) {
        const fd = new FormData()
        fd.set('listing_id', listingId)
        for (const [k, v] of sendPairs) fd.set(k, v)
        // Saving the draft marks the suggestion used, as the About card's Save does.
        if (draftUsed && draft.kind === 'ready') fd.append('ai_suggestion_id', draft.id)
        const result = await updateListingContentAction(null, fd)
        if (result && 'error' in result && result.error) {
          // Nothing was saved; stay on the list so the owner can untick and retry.
          setError(result.error)
          return
        }
        if (draftUsed) openDraft.current = null
        for (const r of rows) if (ticked.has(r.key) && r.locked === null) saved.push(r.label)
        const name = sendPairs.find(([k]) => k === 'name')?.[1]
        const description = sendPairs.find(([k]) => k === 'description')?.[1]
        onSaved({ cards, name, description })
      }

      const failedPhotos: PhotoImportOutcome[] = []
      let coverSet = false
      let brought = 0
      // One import takes MAX_PHOTOS_PER_IMPORT, so more picks go in turns.
      const batches = chunk(photos, MAX_PHOTOS_PER_IMPORT)
      for (const [i, batch] of batches.entries()) {
        const result = await importMySitePhotosAction({
          listingId,
          urls: batch,
          coverUrl: !hasCover && !coverSet && cover && batch.includes(cover) ? cover : null,
          rightsConfirmed: rights,
        })
        if (!result.ok) {
          const left = batches.slice(i).reduce((n, b) => n + b.length, 0)
          saveError = brought > 0 ? `${result.error} ${left === 1 ? '1 photo' : `${left} photos`} didn’t come in.` : result.error
          break
        }
        brought += result.photos.filter((p) => p.ok).length
        failedPhotos.push(...result.photos.filter((p) => !p.ok))
        coverSet ||= result.coverSet
      }
      if (brought > 0) saved.push(brought === 1 ? '1 photo' : `${brought} photos`)

      // A draft the owner didn't keep is recorded as not used.
      if (openDraft.current) {
        void dropSuggestion(openDraft.current)
        openDraft.current = null
      }

      router.refresh()
      setPhase({ kind: 'done', saved, failedPhotos, coverSet, error: saveError })
    })
  }

  return (
    <>
      <SheetHeader className="border-b border-charcoal/8 px-6 py-5">
        <SheetTitle className="font-headline text-xl text-brand-black">From {findings.sourceHost}</SheetTitle>
        <SheetDescription className="font-body text-sm text-charcoal-soft">
          Tick what to bring in. Anything your page already has starts unticked.
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 px-6 py-5">
        {rows.length === 0 && choices.length === 0 && (
          <p className="font-body text-sm text-brand-black">
            Your page already has everything we found on that page.
          </p>
        )}

        {(rows.length > 0 || (canWrite && (help || aboutLocked))) && (
          <fieldset className="min-w-0">
            <legend className="font-subhead text-sm font-bold text-brand-black">Details</legend>
            <ul className="mt-2 flex flex-col gap-2">
              {rows.map((r) => {
                const id = `${ids}-row-${r.key}`
                return (
                  <li
                    key={r.key}
                    className={cn(
                      'rounded-lg border px-3 py-2.5',
                      ticked.has(r.key) && !r.locked ? 'border-brand-black' : 'border-charcoal/12'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        id={id}
                        type="checkbox"
                        checked={ticked.has(r.key) && !r.locked}
                        disabled={r.locked !== null || pending}
                        onChange={(e) => toggle(r.key, e.target.checked)}
                        aria-describedby={`${id}-now`}
                        className="mt-1 size-4 shrink-0 accent-brand-black"
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={id} className="block font-subhead text-sm font-semibold text-brand-black">
                          {r.label}
                        </label>
                        {r.key === 'about' && draft.kind === 'ready' ? (
                          <>
                            <p className="mt-0.5 flex items-center gap-1 font-body text-xs font-semibold text-charcoal">
                              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                              {draft.sample ? 'Sample written from your site' : 'Written from your site'}. Change
                              anything you like.
                            </p>
                            <textarea
                              aria-label="About, written from your site"
                              value={draft.text}
                              rows={8}
                              disabled={pending}
                              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                              className="mt-1 w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm leading-relaxed text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
                            />
                          </>
                        ) : (
                          <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words font-body text-sm text-brand-black">
                            {r.found}
                          </p>
                        )}
                        <p id={`${id}-now`} className="mt-1 line-clamp-3 break-words font-body text-xs text-charcoal-soft">
                          {r.locked ?? (r.current ? `Now: ${r.current}` : 'Empty on your page now')}
                        </p>
                        {r.note && <p className="mt-0.5 font-body text-xs text-charcoal-soft">{r.note}</p>}
                        {r.key === 'about' && canWrite && (
                          <AboutWriter help={help} draft={draft} disabled={pending} onWrite={writeAbout} />
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
              {canWrite && !rows.some((r) => r.key === 'about') && (help || aboutLocked) && (
                <li className="rounded-lg border border-dashed border-charcoal/20 px-3 py-2.5">
                  <p className="font-subhead text-sm font-semibold text-brand-black">About</p>
                  <p className="mt-0.5 font-body text-xs text-charcoal-soft">
                    Your site has more to say than your About does now. We can write one from it for you to check.
                  </p>
                  <AboutWriter help={help} draft={draft} disabled={pending} onWrite={writeAbout} />
                </li>
              )}
            </ul>
            {canWrite && !help && aboutLocked && (
              <div className="mt-2">
                <PlanLimitNote upgradeTo="Starter">
                  Writing an About from your site is part of Starter. You can still bring in your site’s own words above.
                </PlanLimitNote>
              </div>
            )}
          </fieldset>
        )}

        {choices.length > 0 && (
          <fieldset className="min-w-0">
            <legend className="font-subhead text-sm font-bold text-brand-black">Photos from your site</legend>
            <p id={`${ids}-photo-hint`} className="mt-1 font-body text-xs text-charcoal-soft">
              {photoRoom === 0
                ? 'Your plan’s photos are full.'
                : roomShort
                  ? `Your plan has room for ${photoRoom} more. Pick the ones you want most; the rest stay off your page.`
                  : 'Pick the ones you want. They’re added to your photos.'}
            </p>
            <p className="mt-1 font-subhead text-xs font-semibold text-brand-black" aria-live="polite">
              {roomShort ? `${photos.length} of ${photoRoom} picked` : `${photos.length} picked`}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {choices.map((p, i) => {
                const picked = photos.includes(p.url)
                const full = !picked && photosFull
                const id = `${ids}-photo-${i}`
                return (
                  <li
                    key={p.url}
                    className={cn(
                      'overflow-hidden rounded-lg border bg-white',
                      picked ? 'border-brand-black ring-1 ring-brand-black' : 'border-charcoal/15'
                    )}
                  >
                    <div
                      className={cn(
                        'aspect-[4/3] bg-charcoal/5 transition',
                        full ? 'opacity-40 grayscale' : !picked && 'opacity-70'
                      )}
                    >
                      {/* Remote images from the owner's own site, shown before anything is saved. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={p.alt ?? ''}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setBroken((cur) => new Set(cur).add(p.url))
                          setPhotos((cur) => cur.filter((u) => u !== p.url))
                          setCover((c) => (c === p.url ? null : c))
                        }}
                        className={cn('h-full w-full', p.kind === 'logo' ? 'object-contain p-2' : 'object-cover')}
                      />
                    </div>
                    <label
                      htmlFor={id}
                      className={cn(
                        'flex min-h-10 items-center gap-2 px-2 font-subhead text-xs',
                        full ? 'cursor-not-allowed text-charcoal-soft' : 'cursor-pointer text-brand-black'
                      )}
                    >
                      <input
                        id={id}
                        type="checkbox"
                        checked={picked}
                        disabled={pending || full}
                        aria-describedby={`${ids}-photo-hint`}
                        onChange={(e) => {
                          const on = e.target.checked
                          setPhotos((cur) => (on ? [...cur, p.url] : cur.filter((u) => u !== p.url)))
                          if (!on) setCover((c) => (c === p.url ? null : c))
                        }}
                        className="size-4 shrink-0 accent-brand-black"
                      />
                      {full ? 'Plan full' : 'Bring in'}
                      <span className="sr-only">
                        {' '}photo {i + 1}
                        {p.alt ? ` (${p.alt})` : ''}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            {photosFull && roomShort && (
              <div className="mt-3">
                <PlanLimitNote upgradeTo={photoPlan.upgradeTo && photoPlan.nextLimit !== photoPlan.limit ? photoPlan.upgradeTo : null}>
                  {photoPlanLine(photoPlan)}
                </PlanLimitNote>
              </div>
            )}

            {!hasCover && photos.length > 0 && (
              <div className="mt-3">
                <label htmlFor={`${ids}-cover`} className="mb-1 block font-subhead text-xs font-semibold text-charcoal-soft">
                  Your page has no cover yet. Use one as the cover?
                </label>
                <select
                  id={`${ids}-cover`}
                  value={cover ?? ''}
                  onChange={(e) => setCover(e.target.value || null)}
                  className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
                >
                  <option value="">No, I’ll pick a cover later</option>
                  {photos.map((u) => {
                    const n = choices.findIndex((c) => c.url === u) + 1
                    return (
                      <option key={u} value={u}>
                        Photo {n}
                      </option>
                    )
                  })}
                </select>
              </div>
            )}

            {photos.length > 0 && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 font-body text-sm text-brand-black">
                <input
                  id={`${ids}-rights`}
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => {
                    setRights(e.target.checked)
                    setError(null)
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-brand-black"
                />
                I own these photos or have permission to use them.
              </label>
            )}
          </fieldset>
        )}

        {atRisk.length > 0 && save && (
          <div className="flex gap-2 rounded-lg border border-amber-gold/40 bg-amber-gold/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-body text-sm text-brand-black">
                You have unsaved changes in {atRisk.map((c) => CARD_NAMES[c]).join(', ')}. Bringing these in replaces
                them. Save them first to keep both.
              </p>
              <button
                type="button"
                className="mt-1.5 font-subhead text-sm font-semibold text-brand-black underline underline-offset-2"
                disabled={pending}
                onClick={() => void save.saveAll({ focus: false })}
              >
                Save my changes
              </button>
            </div>
          </div>
        )}

        <ErrorLine id={`${ids}-error`} error={error} />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={PRIMARY} disabled={pending || nothingToSave} onClick={apply}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Bringing in…' : 'Bring these in'}
          </button>
          <button
            type="button"
            className={SECONDARY}
            disabled={pending}
            onClick={() => {
              setError(null)
              setPhase({ kind: 'enter' })
            }}
          >
            Try another address
          </button>
        </div>
        <p className="font-body text-xs text-charcoal-soft">
          {cards.length > 0
            ? `Saves to ${[...new Set(cards.map((c) => EDIT_TABS.find((t) => t.id === tabForAnchor(c))?.label))].join(' and ')}.`
            : null}
        </p>
      </div>
    </>
  )
}

type AboutDraft =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; id: string; text: string; sample: boolean }
  | { kind: 'failed'; message: string }

/** Records a drafted About the owner didn't keep. Best effort: nothing to show if it fails. */
async function dropSuggestion(id: string): Promise<void> {
  const form = new FormData()
  form.set('suggestion_id', id)
  try {
    await rejectSuggestionAction(null, form)
  } catch {
    // The suggestion stays open; the About card can still record it later.
  }
}

function photoPlanLine(plan: Props['photoPlan']): string {
  const has =
    plan.limit === null
      ? 'Your plan’s photos are full.'
      : `Your plan includes ${plan.limit} ${plan.limit === 1 ? 'photo' : 'photos'}.`
  if (plan.upgradeTo && plan.nextLimit !== plan.limit) {
    return plan.nextLimit === null
      ? `${has} Upgrade to ${plan.upgradeTo} for more.`
      : `${has} Upgrade to ${plan.upgradeTo} for ${plan.nextLimit}.`
  }
  return `${has} Delete one under Photos & video to make room for another.`
}

/** "Write one from my site": the About drafted by writing help from the site's text. */
function AboutWriter({
  help,
  draft,
  disabled,
  onWrite,
}: {
  help: ReturnType<typeof useWritingHelp>
  draft: AboutDraft
  disabled: boolean
  onWrite: () => void
}) {
  if (!help) return null
  const allowance = help.allowance
  const left = allowance.state === 'ready' ? allowance.left : null
  const out = allowance.state === 'ready' && (allowance.dailyHit || left === 0)
  return (
    <div className="mt-2 flex flex-col gap-1">
      <div>
        <button
          type="button"
          className={cn(SECONDARY, 'h-9 px-3 text-xs')}
          disabled={disabled || out || draft.kind === 'loading'}
          onClick={onWrite}
        >
          {draft.kind === 'loading' ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {draft.kind === 'loading'
            ? 'Writing…'
            : draft.kind === 'ready'
              ? 'Write another'
              : 'Write one from my site'}
        </button>
      </div>
      <p className="font-body text-xs text-charcoal-soft" aria-live="polite">
        {draft.kind === 'failed'
          ? draft.message
          : out
            ? 'You’ve used your drafts for now.'
            : left !== null
              ? `Uses 1 of your ${left} ${left === 1 ? 'draft' : 'drafts'} left.`
              : 'We write it from your site’s text. Nothing is saved until you bring it in.'}
      </p>
    </div>
  )
}

function ErrorLine({ id, error }: { id: string; error: string | null }) {
  return (
    <div aria-live="polite">
      {error && (
        <p id={id} role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
