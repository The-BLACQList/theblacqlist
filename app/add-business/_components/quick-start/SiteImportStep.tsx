'use client'

import { useId, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'

import { importSitePhotosAction, readSiteAction, type PhotoImportOutcome } from '@/lib/actions/listings/siteImport'
import type { SiteFindings } from '@/lib/import/read-site'
import {
  applyFindings,
  businessDomainFromEmail,
  findConflicts,
  type CityMatch,
  type ConflictChoices,
  type SiteDraft,
} from '@/lib/import/siteDraft'
import type { QuickStartAnswers } from '@/lib/listings/quickStart'
import { initialRoles, PhotoPicker, type PhotoRoles } from './PhotoPicker'
import { FoundList, WhichIsRight } from './SiteFindingsList'
import { HINT_CLASS, inputClass, LABEL_CLASS, StepIntro } from './shared'

// Step 0 of /add-business (ticket 127): "Bring in what you already have".
// The owner gives their site, we read that one page once, and they confirm
// what to keep. Skipping is always one tap away.

interface Props {
  answers: QuickStartAnswers
  cities: readonly CityMatch[]
  signInEmail: string
  onDone: (patch: Partial<QuickStartAnswers>, site: SiteDraft) => void
  onSkip: () => void
}

type Phase =
  | { kind: 'enter' }
  | { kind: 'review'; findings: SiteFindings }
  | { kind: 'partial'; patch: Partial<QuickStartAnswers>; site: SiteDraft; failed: PhotoImportOutcome[] }

const PRIMARY =
  'inline-flex h-12 min-w-[9rem] items-center justify-center gap-2 rounded-full bg-brand-black px-6 font-subhead text-base font-bold text-white hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2 disabled:opacity-70'
const SECONDARY =
  'inline-flex h-12 items-center rounded-full px-4 font-subhead text-base font-semibold text-brand-black underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black disabled:opacity-50'

export function SiteImportStep({ answers, cities, signInEmail, onDone, onSkip }: Props) {
  const [url, setUrl] = useState(() => businessDomainFromEmail(signInEmail))
  const [phase, setPhase] = useState<Phase>({ kind: 'enter' })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [choices, setChoices] = useState<ConflictChoices>({ name: 'typed', phone: null, email: 'site' })
  const [roles, setRoles] = useState<PhotoRoles>({})
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set())
  const [rights, setRights] = useState(false)
  const urlId = useId()

  function read() {
    setError(null)
    startTransition(async () => {
      const result = await readSiteAction(url)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const f = result.findings
      setChoices({ name: 'typed', phone: f.phones[0] ?? null, email: 'site' })
      setRoles(initialRoles(f.photos, f.suggestedLogo, f.suggestedCover))
      setBroken(new Set())
      setRights(false)
      setPhase({ kind: 'review', findings: f })
      requestAnimationFrame(() => document.getElementById('qs-step-title')?.focus())
    })
  }

  function use(findings: SiteFindings) {
    setError(null)
    const picks = Object.entries(roles)
      .filter(([u, r]) => r !== 'skip' && !broken.has(u))
      .map(([u, r]) => ({ url: u, role: r as 'logo' | 'cover' | 'gallery' }))
    if (picks.length > 0 && !rights) {
      setError('Confirm you own these photos or have permission to use them.')
      document.getElementById('qs-photo-rights')?.focus()
      return
    }

    const tempId = crypto.randomUUID()
    const { patch, site } = applyFindings({ findings, answers, choices, cities, tempId })
    if (picks.length === 0) {
      onDone(patch, site)
      return
    }

    startTransition(async () => {
      const result = await importSitePhotosAction({ listingId: tempId, picks, rightsConfirmed: rights })
      if (!result.ok) {
        setError(result.error)
        return
      }
      const withPhotos: SiteDraft = {
        ...site,
        logoPath: pathOf(result.photos, 'logo'),
        coverPath: pathOf(result.photos, 'cover'),
      }
      const failed = result.photos.filter((p) => !p.ok)
      if (failed.length === 0) onDone(patch, withPhotos)
      else setPhase({ kind: 'partial', patch, site: withPhotos, failed })
    })
  }

  if (phase.kind === 'partial') {
    return (
      <div className="flex flex-col gap-5">
        <StepIntro title="Some photos didn't come in">
          The rest of your info is ready. You can add these photos yourself on the next page.
        </StepIntro>
        <ul className="flex flex-col gap-2">
          {phase.failed.map((p) => (
            <li key={`${p.role}:${p.url}`} className="rounded-lg bg-white px-4 py-3 font-subhead text-sm text-charcoal">
              <span className="font-semibold capitalize text-brand-black">{p.role === 'gallery' ? 'Page photo' : p.role}:</span>{' '}
              {!p.ok && p.message}
            </li>
          ))}
        </ul>
        <div>
          <button type="button" className={PRIMARY} onClick={() => onDone(phase.patch, phase.site)}>
            Continue without them
          </button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'review') {
    const f = phase.findings
    const picked = Object.entries(roles).some(([u, r]) => r !== 'skip' && !broken.has(u))
    return (
      <div className="flex flex-col gap-6">
        <StepIntro title={`Here's what we found on ${f.sourceHost}`}>
          Keep what&apos;s right. You can change anything later.
        </StepIntro>
        <FoundList findings={f} />
        <WhichIsRight conflicts={findConflicts(f, answers, signInEmail)} choices={choices} onChange={setChoices} />
        <PhotoPicker
          photos={f.photos}
          roles={roles}
          onChange={setRoles}
          broken={broken}
          onBroken={(u) => setBroken((prev) => new Set(prev).add(u))}
        />
        {picked && (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 font-subhead text-base text-brand-black">
            <input
              id="qs-photo-rights"
              type="checkbox"
              checked={rights}
              onChange={(e) => {
                setRights(e.target.checked)
                setError(null)
              }}
              className="mt-1 size-5 shrink-0 accent-brand-black"
            />
            I own these photos or have permission to use them.
          </label>
        )}
        <p className={HINT_CLASS}>We read your public page once, when you ask. Nothing comes in that you don&apos;t pick.</p>
        <ErrorLine error={error} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={PRIMARY} disabled={pending} onClick={() => use(f)}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Bringing in photos…' : 'Use this'}
          </button>
          <button type="button" className={SECONDARY} disabled={pending} onClick={() => setPhase({ kind: 'enter' })}>
            Try another address
          </button>
          <button type="button" className={SECONDARY} disabled={pending} onClick={onSkip}>
            Skip, I&apos;ll type it
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      aria-labelledby="qs-step-title"
      onSubmit={(e) => {
        e.preventDefault()
        read()
      }}
    >
      <StepIntro title="Have a website or link page?">
        We can bring in your name, about, phone, hours and photos so you type less. You check
        everything before it goes on your page.
      </StepIntro>
      <div>
        <label htmlFor={urlId} className={LABEL_CLASS}>
          Your website or link-in-bio page
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yoursite.com"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'qs-site-error' : undefined}
          className={inputClass(Boolean(error))}
        />
      </div>
      {pending && (
        <p role="status" className="flex items-center gap-2 font-subhead text-sm text-charcoal">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Reading your page…
        </p>
      )}
      <ErrorLine error={error} id="qs-site-error" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={PRIMARY} disabled={pending || !url.trim()}>
          Bring in my info
        </button>
        <button type="button" className={SECONDARY} disabled={pending} onClick={onSkip}>
          Skip, I&apos;ll type it
        </button>
      </div>
    </form>
  )
}

function pathOf(photos: PhotoImportOutcome[], role: 'logo' | 'cover'): string | null {
  const hit = photos.find((p) => p.role === role && p.ok)
  return hit && hit.ok ? hit.path : null
}

function ErrorLine({ error, id }: { error: string | null; id?: string }) {
  if (!error) return null
  return (
    <p id={id} role="alert" className="font-subhead text-sm font-semibold text-red-700">
      {error}
    </p>
  )
}
