'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { FIELD_IDS, NAME_MAX, NAME_MIN } from '@/lib/listings/quickStart'
import { HINT_CLASS, LABEL_CLASS, StepError, StepIntro, fieldA11y, inputClass, type StepProps } from './shared'

interface Match {
  id: string
  name: string
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

export function NameStep({ answers, onChange, problem }: StepProps) {
  const matches = useNameMatches(answers.name)

  return (
    <>
      <StepIntro title="What's your business called?" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_IDS.name} className={LABEL_CLASS}>
          Business name
        </label>
        <input
          id={FIELD_IDS.name}
          type="text"
          autoComplete="organization"
          value={answers.name}
          onChange={(e) => onChange({ name: e.target.value })}
          minLength={NAME_MIN}
          maxLength={NAME_MAX}
          placeholder="Fade Lab Barbershop"
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
              Is this you? Claim it
            </h3>
            <p className={HINT_CLASS}>
              If your business is already listed, claim that page instead of adding a new one.
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
                <Link
                  href={`/claim/${m.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-brand-black px-4 font-subhead text-sm font-bold text-brand-black hover:bg-brand-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
                >
                  Claim this page
                  <span className="sr-only">: {m.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className={HINT_CLASS}>Not yours? Keep going.</p>
        </section>
      )}
    </>
  )
}
