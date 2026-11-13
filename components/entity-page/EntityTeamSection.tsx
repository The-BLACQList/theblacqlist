import Image from 'next/image'
import { TemplateSectionHeading } from '@/components/entity-page/templates/TemplateSectionHeading'
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

function Avatar({ member }: { member: TeamMember }) {
  if (member.photo) {
    return (
      <span className="relative block size-20 overflow-hidden rounded-full ring-2 ring-white shadow-sm">
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
      className="flex size-20 items-center justify-center rounded-full bg-deep-bg font-headline text-2xl text-gold ring-2 ring-white shadow-sm"
    >
      {initialsFor(member.name)}
    </span>
  )
}

/**
 * The people behind the business (ticket 107; display here, data in Phase 4).
 * Hidden until a loader provides `team`. Growth shows up to five, Premium is
 * uncapped — `applyTierGates` does the slicing, this just renders.
 */
export function EntityTeamSection({ team, bare = false }: Props) {
  if (!team || team.length === 0) return null

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
          {team.map((member) => (
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
          ))}
        </ul>
      </div>
    </section>
  )
}
