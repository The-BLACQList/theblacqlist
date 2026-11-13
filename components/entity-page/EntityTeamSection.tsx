import Image from 'next/image'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
import { founderFirst, splitFounderBio } from '@/lib/listings/team'
import type { TeamMember } from '@/types'

interface Props {
  team: TeamMember[] | undefined
  /** Inside a two-column body: no band, no width wrapper, kicker-style heading. */
  bare?: boolean
}

/** "Ada Lovelace" → "AL"; a single name gives one letter. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

function Avatar({ member, large = false }: { member: TeamMember; large?: boolean }) {
  const size = large ? 'size-24 md:size-28' : 'size-20'
  if (member.photo) {
    return (
      <span
        className={`relative block ${size} shrink-0 overflow-hidden rounded-full ring-2 ring-white shadow-sm`}
      >
        <Image
          src={member.photo.src}
          alt={member.photo.alt || member.name}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized={member.photo.unoptimized}
        />
      </span>
    )
  }
  // No photo → initials on the brand ground. Sample pages always take this
  // branch: stock portraits carry no model release, and naming a stranger
  // "Head Barista" implies an endorsement nobody gave.
  return (
    <span
      aria-hidden="true"
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-deep-bg font-headline ${large ? 'text-3xl' : 'text-2xl'} text-gold ring-2 ring-white shadow-sm`}
    >
      {initialsFor(member.name)}
    </span>
  )
}

/**
 * The owner's card (ticket 107 `is_founder`): first, two columns wide, with
 * the "Owner" label and the first line of the bio set as a pull quote. The
 * platform exists for the person behind the business; this is where they are.
 */
function FounderCard({ member }: { member: TeamMember }) {
  const { quote, rest } = splitFounderBio(member.bio)
  return (
    <li
      data-testid="founder-card"
      className="sm:col-span-2 flex flex-col sm:flex-row items-start gap-5 rounded-xl bg-white border border-gold/70 p-5 md:p-6"
    >
      <Avatar member={member} large />
      <div className="min-w-0">
        <span className="inline-flex items-center rounded-full bg-gold/20 px-2.5 py-0.5 font-subhead text-[11px] font-bold uppercase tracking-[0.12em] text-amber">
          Owner
        </span>
        <p className="mt-2 font-subhead text-lg font-semibold text-brand-black">{member.name}</p>
        {member.role && (
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mt-0.5">
            {member.role}
          </p>
        )}
        {quote && (
          <blockquote className="mt-3 font-headline text-[19px] md:text-[21px] leading-snug text-brand-black">
            “{quote}”
          </blockquote>
        )}
        {rest && <p className="font-body text-sm leading-relaxed text-charcoal mt-2">{rest}</p>}
      </div>
    </li>
  )
}

/**
 * The people behind the business (ticket 107; display here, data in Phase 4).
 * Hidden until a loader provides `team`. Growth shows up to five, Premium is
 * uncapped — `applyTierGates` does the slicing, this just renders.
 */
export function EntityTeamSection({ team, bare = false }: Props) {
  if (!team || team.length === 0) return null
  const members = founderFirst(team)

  return (
    <section
      aria-labelledby="team-heading"
      className={bare ? undefined : 'bg-cream py-12 md:py-16'}
    >
      <div className={bare ? undefined : 'max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8'}>
        {bare ? (
          <TemplateSectionHeading
            kicker="Who you'll work with"
            heading="Meet the team"
            headingId="team-heading"
          />
        ) : (
          <h2
            id="team-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
          >
            Meet the team
          </h2>
        )}
        <ul
          className={
            bare
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-5'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'
          }
        >
          {members.map((member) =>
            member.isFounder ? (
              <FounderCard key={member.id} member={member} />
            ) : (
              <li
                key={member.id}
                className="flex flex-col items-start gap-4 rounded-xl bg-white border border-charcoal/10 p-5"
              >
                <Avatar member={member} />
                <div className="min-w-0">
                  <p className="font-subhead text-base font-semibold text-brand-black">
                    {member.name}
                  </p>
                  {member.role && (
                    <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mt-0.5">
                      {member.role}
                    </p>
                  )}
                  {member.bio && (
                    <p className="font-body text-sm leading-relaxed text-charcoal mt-2">
                      {member.bio}
                    </p>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  )
}
