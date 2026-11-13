'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Globe, Loader2 } from 'lucide-react'
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
import type { SiteFindings } from '@/lib/import/read-site'
import type { PhotoImportOutcome } from '@/lib/import/siteImportCore'
import {
  cardsFor,
  importRows,
  pairsFor,
  photoChoices,
  type ImportCard,
  type ImportOptions,
  type ImportRow,
  type PageNow,
} from '@/lib/import/ownerImport'
import { EDIT_TABS, tabForAnchor } from '@/lib/listings/editTabs'
import { useChangedCards, useProfileSave } from './ProfileSave'

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
  /** Photos the plan has room for now (at most one import's worth). */
  photoRoom: number
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
  onSaved,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter()
  const save = useProfileSave()
  const changedCards = useChangedCards()
  const ids = useId()
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

  const { findings, rows } = phase
  const choices = photoChoices(findings).filter((p) => !broken.has(p.url))
  const sendPairs = pairsFor(rows, ticked)
  const cards = cardsFor(rows, ticked)
  // Ticked fields refresh their cards, which would drop what the owner typed there.
  const atRisk = cards.filter((c) => changedCards.includes(c))
  const nothingToSave = sendPairs.length === 0 && photos.length === 0
  const photosFull = photos.length >= photoRoom

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
        const result = await updateListingContentAction(null, fd)
        if (result && 'error' in result && result.error) {
          // Nothing was saved; stay on the list so the owner can untick and retry.
          setError(result.error)
          return
        }
        for (const r of rows) if (ticked.has(r.key) && r.locked === null) saved.push(r.label)
        const name = sendPairs.find(([k]) => k === 'name')?.[1]
        const description = sendPairs.find(([k]) => k === 'description')?.[1]
        onSaved({ cards, name, description })
      }

      let failedPhotos: PhotoImportOutcome[] = []
      let coverSet = false
      if (photos.length > 0) {
        const result = await importMySitePhotosAction({
          listingId,
          urls: photos,
          coverUrl: !hasCover ? cover : null,
          rightsConfirmed: rights,
        })
        if (!result.ok) {
          saveError = result.error
        } else {
          const ok = result.photos.filter((p) => p.ok).length
          if (ok > 0) saved.push(ok === 1 ? '1 photo' : `${ok} photos`)
          failedPhotos = result.photos.filter((p) => !p.ok)
          coverSet = result.coverSet
        }
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

        {rows.length > 0 && (
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
                        <p className="mt-0.5 line-clamp-4 break-words font-body text-sm text-brand-black">{r.found}</p>
                        <p id={`${id}-now`} className="mt-1 break-words font-body text-xs text-charcoal-soft">
                          {r.locked ?? (r.current ? `Now: ${r.current}` : 'Empty on your page now')}
                        </p>
                        {r.note && <p className="mt-0.5 font-body text-xs text-charcoal-soft">{r.note}</p>}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )}

        {choices.length > 0 && (
          <fieldset className="min-w-0">
            <legend className="font-subhead text-sm font-bold text-brand-black">Photos from your site</legend>
            <p id={`${ids}-photo-hint`} className="mt-1 font-body text-xs text-charcoal-soft">
              {photoRoom === 0
                ? 'Your plan’s photos are full. Delete one under Photos & video to bring more in.'
                : `Pick up to ${photoRoom}. They’re added to your photos.`}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {choices.map((p, i) => {
                const picked = photos.includes(p.url)
                const id = `${ids}-photo-${i}`
                return (
                  <li
                    key={p.url}
                    className={cn(
                      'overflow-hidden rounded-lg border bg-white',
                      picked ? 'border-brand-black ring-1 ring-brand-black' : 'border-charcoal/15'
                    )}
                  >
                    <div className={cn('aspect-[4/3] bg-charcoal/5', !picked && 'opacity-70')}>
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
                    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-2 px-2 font-subhead text-xs text-brand-black">
                      <input
                        id={id}
                        type="checkbox"
                        checked={picked}
                        disabled={pending || (!picked && photosFull)}
                        aria-describedby={`${ids}-photo-hint`}
                        onChange={(e) => {
                          const on = e.target.checked
                          setPhotos((cur) => (on ? [...cur, p.url] : cur.filter((u) => u !== p.url)))
                          if (!on) setCover((c) => (c === p.url ? null : c))
                        }}
                        className="size-4 shrink-0 accent-brand-black"
                      />
                      Bring in
                      <span className="sr-only">
                        {' '}photo {i + 1}
                        {p.alt ? ` (${p.alt})` : ''}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

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
