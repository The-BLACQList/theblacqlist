import type { TeamMember } from '@/types'

/** Founders first, everyone else in the order given (a stable partition). */
export function founderFirst(team: readonly TeamMember[]): TeamMember[] {
  return [...team.filter((m) => m.isFounder), ...team.filter((m) => !m.isFounder)]
}

const MAX_QUOTE_CHARS = 140

/**
 * The founder card's pull quote is the bio's first sentence, when it is short
 * enough to read as one line; the rest of the bio follows as the paragraph.
 * A bio with one sentence is all quote; a long first sentence is all paragraph.
 */
export function splitFounderBio(bio: string | null): { quote: string | null; rest: string | null } {
  const text = bio?.trim() ?? ''
  if (!text) return { quote: null, rest: null }
  const [first = '', ...others] = text.split(/(?<=[.!?])\s+/)
  if (first.length > MAX_QUOTE_CHARS) return { quote: null, rest: text }
  const rest = others.join(' ').trim()
  return { quote: first.replace(/[.]$/, ''), rest: rest || null }
}

// ── Ticket 107: the stored team (listing_team_members) ──────────────────────

export const TEAM_NAME_MAX = 80
export const TEAM_ROLE_MAX = 60
export const TEAM_BIO_MAX = 400
/** Saved members a page, whatever the plan: a bound on the owner's list, not a plan limit. */
export const TEAM_SAVED_MAX = 50

export const TEAM_COLUMNS = 'id, name, role, bio, photo_path, is_founder, sort_order'

/** A row as the owner's editor and the page loader read it. */
export interface OwnerTeamMember {
  id: string
  name: string
  role: string | null
  bio: string | null
  photo_path: string | null
  is_founder: boolean
  sort_order: number
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** A photo the owner uploaded with media_role=team for this page. */
export function isUploadedTeamPhotoPath(
  listingId: string,
  path: string | null | undefined
): boolean {
  if (!path || !new RegExp(`^${UUID}$`, 'i').test(listingId)) return false
  return new RegExp(`^listings/${listingId}/team/${UUID}\\.(jpg|png|webp)$`, 'i').test(path)
}

/** Rows from the database, checked and in the owner's order. Bad rows are dropped. */
export function toOwnerTeam(rows: unknown): OwnerTeamMember[] {
  if (!Array.isArray(rows)) return []
  const out: OwnerTeamMember[] = []
  for (const r of rows as Record<string, unknown>[]) {
    if (typeof r?.id !== 'string' || typeof r.name !== 'string' || !r.name.trim()) continue
    out.push({
      id: r.id,
      name: r.name,
      role: typeof r.role === 'string' && r.role.trim() ? r.role : null,
      bio: typeof r.bio === 'string' && r.bio.trim() ? r.bio : null,
      photo_path: typeof r.photo_path === 'string' && r.photo_path ? r.photo_path : null,
      is_founder: r.is_founder === true,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : 0,
    })
  }
  return out.sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * The page's team: the owner's order, cut to what the plan shows (`cap`, null
 * for no cap). The founder card is moved first by the section itself.
 *
 * The photo's alt text is empty on purpose: the member's name sits right
 * beside it, so a screen reader would hear the name twice.
 */
export function toPublicTeam(
  members: OwnerTeamMember[],
  cap: number | null,
  resolvePath: (path: string) => string | null
): TeamMember[] {
  const shown = cap === null ? members : members.slice(0, Math.max(0, cap))
  return shown.map((m) => {
    const src = m.photo_path ? resolvePath(m.photo_path) : null
    return {
      id: m.id,
      name: m.name.trim(),
      role: m.role?.trim() || null,
      bio: m.bio?.trim() || null,
      photo: src ? { src, alt: '' } : null,
      isFounder: m.is_founder,
    }
  })
}

export type ParsedTeamMember =
  | {
      ok: true
      value: { name: string; role: string | null; bio: string | null; is_founder: boolean }
    }
  | { ok: false; error: string }

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

/** The owner's form, checked the way the table's CHECKs will check it. */
export function parseTeamMember(input: {
  name: unknown
  role: unknown
  bio: unknown
  isFounder: unknown
}): ParsedTeamMember {
  const name = oneLine(input.name)
  const role = oneLine(input.role)
  const bio = typeof input.bio === 'string' ? input.bio.trim() : ''
  if (!name) return { ok: false, error: 'Add a name.' }
  if (name.length > TEAM_NAME_MAX) {
    return { ok: false, error: `Keep the name to ${TEAM_NAME_MAX} characters.` }
  }
  if (role.length > TEAM_ROLE_MAX) {
    return { ok: false, error: `Keep the role to ${TEAM_ROLE_MAX} characters.` }
  }
  if (bio.length > TEAM_BIO_MAX) {
    return { ok: false, error: `Keep the bio to ${TEAM_BIO_MAX} characters.` }
  }
  return {
    ok: true,
    value: { name, role: role || null, bio: bio || null, is_founder: input.isFounder === true },
  }
}
