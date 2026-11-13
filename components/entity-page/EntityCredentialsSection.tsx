import {
  Award,
  BadgeCheck,
  ExternalLink,
  Newspaper,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import type { CredentialItem } from '@/types'

interface Props {
  credentials: CredentialItem[] | undefined
  /** In the trust aside: a compact card instead of a full-width band. */
  bare?: boolean
  /** Overrides the heading ("Awards & press" in a band, "Credentials" in the aside). */
  title?: string
}

type Kind = CredentialItem['kind']

const KIND_ORDER: readonly Kind[] = ['license', 'certification', 'award', 'press']
const KIND_LABEL: Record<Kind, string> = {
  license: 'Licenses',
  certification: 'Certifications',
  award: 'Awards',
  press: 'Press',
}
const KIND_ICON: Record<Kind, LucideIcon> = {
  license: ShieldCheck,
  certification: BadgeCheck,
  award: Award,
  press: Newspaper,
}

/**
 * Licenses, certifications, awards and press (ticket 192; display here, data
 * in Phase 8): the trust a business brings with it, as distinct from the
 * platform's own trust panel. Grouped by kind; press items are text links
 * (no publication logos — licensing).
 */
export function EntityCredentialsSection({ credentials, bare = false, title }: Props) {
  if (!credentials || credentials.length === 0) return null
  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: credentials.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0)
  const heading = title ?? (bare ? 'Credentials' : 'Awards & press')

  const list = (items: CredentialItem[], kind: Kind) => {
    const Icon = KIND_ICON[kind]
    return (
      <ul className="list-none p-0 m-0 flex flex-col gap-3">
        {items.map((c) => {
          const meta = [c.issuer, c.year].filter(Boolean).join(' · ')
          return (
            <li key={c.id} className="flex items-start gap-2.5">
              <Icon className="size-4 mt-0.5 shrink-0 text-amber" aria-hidden="true" />
              <div className="min-w-0">
                {c.href ? (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-baseline gap-1 font-subhead text-sm font-semibold text-brand-black underline-offset-4 hover:underline"
                  >
                    {c.title}
                    <ExternalLink className="size-3 shrink-0 self-center" aria-hidden="true" />
                  </a>
                ) : (
                  <p className="font-subhead text-sm font-semibold text-brand-black">{c.title}</p>
                )}
                {meta && <p className="font-body text-[13px] text-charcoal-soft">{meta}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    )
  }

  if (bare) {
    return (
      <section
        aria-labelledby="credentials-heading"
        className="mt-6 rounded-xl border border-charcoal/10 bg-white p-5 md:p-6"
      >
        <h2 id="credentials-heading" className="font-headline text-[19px] text-brand-black mb-4">
          {heading}
        </h2>
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.kind}>
              <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-2">
                {KIND_LABEL[g.kind]}
              </p>
              {list(g.items, g.kind)}
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="credentials-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="credentials-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          {heading}
        </h2>
        <div
          className={`grid grid-cols-1 gap-8 ${groups.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}
        >
          {groups.map((g) => (
            <div key={g.kind} className="rounded-xl bg-cream border border-charcoal/10 p-5">
              <p className="font-subhead text-xs font-semibold text-charcoal uppercase tracking-wide mb-3">
                {KIND_LABEL[g.kind]}
              </p>
              {list(g.items, g.kind)}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
