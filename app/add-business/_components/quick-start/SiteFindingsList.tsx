'use client'

import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SiteFindings } from '@/lib/import/read-site'
import type { ConflictChoices, SiteConflicts } from '@/lib/import/siteDraft'
import { ChoiceCards } from './ChoiceCards'
import { HINT_CLASS } from './shared'

// Step 0's review (ticket 127): a found / not found line for each part of the
// page, then one "Which is right?" card when the site and the draft disagree.

interface Row {
  label: string
  value: string | null
  note?: string
}

function rows(f: SiteFindings): Row[] {
  const socials = Object.values(f.socials).filter(Boolean).length
  const addr = f.address
  const place = addr ? [addr.street, addr.city, addr.state].filter(Boolean).join(', ') : ''
  const openDays = f.hours ? Object.values(f.hours).filter((d) => d && !d.closed && d.open && d.close).length : 0
  return [
    { label: 'Name', value: f.name },
    { label: 'About', value: f.about ? (f.about.length > 90 ? `${f.about.slice(0, 90).trim()}...` : f.about) : null },
    { label: 'Phone', value: f.phones[0] ?? null },
    { label: 'Email', value: f.emails[0] ?? null },
    { label: 'Address', value: place || null },
    { label: 'Hours', value: openDays ? `Open ${openDays} ${openDays === 1 ? 'day' : 'days'} a week` : null },
    {
      label: 'Social links',
      value: socials ? `${socials} found` : null,
      note: socials ? 'Saved now. They show on your page with Starter.' : undefined,
    },
    { label: 'Photos', value: f.photos.length ? `${f.photos.length} to pick from` : null },
  ]
}

export function FoundList({ findings }: { findings: SiteFindings }) {
  return (
    <ul className="divide-y divide-charcoal/10 rounded-xl border border-charcoal/15 bg-white">
      {rows(findings).map((row) => (
        <li key={row.label} className="flex items-start gap-3 px-4 py-3">
          {row.value ? (
            <Check className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : (
            <Minus className="mt-0.5 size-5 shrink-0 text-charcoal-faint" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              {row.label}
              <span className="sr-only">{row.value ? ': found' : ': not found'}</span>
            </p>
            <p className={cn('font-subhead text-sm break-words', row.value ? 'text-charcoal' : 'text-charcoal-soft')}>
              {row.value ?? 'Not found. You can add it later.'}
            </p>
            {row.note && <p className={cn(HINT_CLASS, 'mt-0.5')}>{row.note}</p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function hasConflicts(c: SiteConflicts): boolean {
  return Boolean(c.name || c.phones.length > 1 || c.email)
}

interface ConflictProps {
  conflicts: SiteConflicts
  choices: ConflictChoices
  onChange: (choices: ConflictChoices) => void
}

export function WhichIsRight({ conflicts, choices, onChange }: ConflictProps) {
  if (!hasConflicts(conflicts)) return null
  return (
    <section aria-labelledby="qs-which-title" className="flex flex-col gap-5 rounded-xl border border-amber-gold/60 bg-amber-gold/10 p-4">
      <div>
        <h3 id="qs-which-title" className="font-subhead text-base font-bold text-brand-black">
          Which is right?
        </h3>
        <p className={HINT_CLASS}>Your site and your answers don&apos;t match here. Pick one for your page.</p>
      </div>

      {conflicts.name && (
        <Question title="Business name">
          <ChoiceCards
            name="qs-which-name"
            legend="Business name"
            idPrefix="qs-which-name"
            columns={1}
            value={choices.name}
            onChange={(v) => onChange({ ...choices, name: v as ConflictChoices['name'] })}
            choices={[
              { value: 'typed', title: conflicts.name.typed, hint: 'What you typed' },
              { value: 'site', title: conflicts.name.site, hint: 'From your site' },
            ]}
          />
        </Question>
      )}

      {conflicts.phones.length > 1 && (
        <Question title="Phone number">
          <ChoiceCards
            name="qs-which-phone"
            legend="Phone number"
            idPrefix="qs-which-phone"
            columns={1}
            value={choices.phone ?? conflicts.phones[0]!}
            onChange={(v) => onChange({ ...choices, phone: v })}
            choices={conflicts.phones.map((p) => ({ value: p, title: p }))}
          />
        </Question>
      )}

      {conflicts.email && (
        <Question title="Email on your page">
          <ChoiceCards
            name="qs-which-email"
            legend="Email on your page"
            idPrefix="qs-which-email"
            columns={1}
            value={choices.email}
            onChange={(v) => onChange({ ...choices, email: v as ConflictChoices['email'] })}
            choices={[
              { value: 'site', title: conflicts.email.site, hint: 'From your site' },
              { value: 'signIn', title: conflicts.email.signIn, hint: 'The one you sign in with' },
            ]}
          />
        </Question>
      )}
    </section>
  )
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-subhead text-sm font-semibold text-brand-black" aria-hidden="true">
        {title}
      </p>
      {children}
    </div>
  )
}
