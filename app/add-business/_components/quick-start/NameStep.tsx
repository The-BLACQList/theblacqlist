'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { FIELD_IDS, NAME_MAX, NAME_MIN } from '@/lib/listings/quickStart'
import {
  HINT_CLASS,
  LABEL_CLASS,
  StepError,
  StepIntro,
  fieldA11y,
  inputClass,
  type StepProps,
} from './shared'

interface Match {
  id: string
  name: string
  ownership: 'open' | 'yours' | 'managed'
  city: { name: string } | null
}

// Matches by name in any city, so an owner whose page already exists claims it
// instead of making a second one. Signed-out or failed checks show nothing:
// this is a nudge, never a blocker.
function useNameMatches(name: string): Match[] {
  const [matches, setMatches] = useState<{ query: string; list: Match[] }>({ query: '', list: [] })
  const query = name.trim()

  useEffect(() => {
    if (query.length < 3) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/listings/duplicate-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: query }),
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = (await res.json()) as { data?: { duplicates?: Match[] } }
        setMatches({ query, list: (json.data?.duplicates ?? []).slice(0, 3) })
      } catch {
        // Aborted or offline. Leave the last result alone.
      }
    }, 450)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  return query.length >= 3 && matches.query === query ? matches.list : []
}

const ACTION_CLASS =
  'inline-flex min-h-[44px] items-center rounded-full border border-brand-black px-4 font-subhead text-sm font-bold text-brand-black hover:bg-brand-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2'

// Only an open page offers a claim: claims on pages with a different owner are
// refused at submit, so offering one would be a dead end.
function MatchAction({ match: m }: { match: Match }) {
  if (m.ownership === 'open') {
    return (
      <Link href={`/claim/${m.id}`} className={ACTION_CLASS}>
        This is mine, claim it
        <span className="sr-only">: {m.name}</span>
      </Link>
    )
  }
  if (m.ownership === 'yours') {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={HINT_CLASS}>You manage this page</span>
        <Link href={`/dashboard/pages/${m.id}/edit`} className={ACTION_CLASS}>
          Go to your page
          <span className="sr-only">: {m.name}</span>
        </Link>
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={HINT_CLASS}>Managed by its owner</span>
      <Link
        href="/contact"
        className="inline-flex min-h-[44px] items-center font-subhead text-xs font-semibold text-charcoal-soft underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
      >
        Not right? Contact us
        <span className="sr-only"> about {m.name}</span>
      </Link>
    </span>
  )
}

export function NameStep({ answers, onChange, problem, mode }: StepProps) {
  const creator = mode === 'creator'
  // Creators add themselves only, so there is no existing page to claim.
  const matches = useNameMatches(creator ? '' : answers.name)

  return (
    <>
      <StepIntro title={creator ? 'What do people call you?' : "What's your business called?"}>
        {creator ? 'Your creator name, the one your followers know.' : null}
      </StepIntro>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_IDS.name} className={LABEL_CLASS}>
          {creator ? 'Creator name' : 'Business name'}
        </label>
        <input
          id={FIELD_IDS.name}
          type="text"
          autoComplete={creator ? 'nickname' : 'organization'}
          value={answers.name}
          onChange={(e) => onChange({ name: e.target.value })}
          minLength={NAME_MIN}
          maxLength={NAME_MAX}
          placeholder={creator ? 'Chef Kiana Eats' : 'Fade Lab Barbershop'}
          className={inputClass(problem?.fieldId === FIELD_IDS.name)}
          {...fieldA11y(problem, FIELD_IDS.name)}
        />
      </div>
      <StepError problem={problem} />

      {matches.length > 0 && (
        <section
          aria-labelledby="qs-claim-title"
          className="flex shrink-0 flex-col gap-3 rounded-xl border border-amber-gold/50 bg-amber-gold/10 p-4"
        >
          <div>
            <h3 id="qs-claim-title" className="font-subhead text-base font-bold text-brand-black">
              Already on BLACQList?
            </h3>
            <p className={HINT_CLASS}>
              If your business is already listed, use that page instead of adding a new one.
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {matches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2.5"
              >
                <span className="min-w-0 font-subhead text-sm text-brand-black">
                  <span className="font-semibold">{m.name}</span>
                  {m.city && <span className="text-charcoal-soft"> · {m.city.name}</span>}
                </span>
                <MatchAction match={m} />
              </li>
            ))}
          </ul>
          <p className={HINT_CLASS}>Not yours? Keep going.</p>
        </section>
      )}
    </>
  )
}
