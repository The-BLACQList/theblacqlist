import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 107: team members. What is pinned here:
//   * the rules: a member's name, role and bio are checked the way the
//     table's CHECKs check them, and only this page's uploaded photos count.
//   * the plan: below Growth no one can be added; Growth adds up to 5,
//     Premium any number. Edit, reorder and remove work on every plan.
//   * the page shows the first ones the plan allows, with decorative photos.
//   * one founder a page: marking a new one clears the old one first.
//   * the migration, the loader and the dashboard are wired.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const OTHER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const PHOTO_NAME = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.jpg'
const PHOTO = `listings/${LISTING_ID}/team/${PHOTO_NAME}`
const OLD_PHOTO = `listings/${LISTING_ID}/team/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.png`
const M1 = '11111111-1111-4111-8111-111111111111'
const M2 = '22222222-2222-4222-8222-222222222222'
const M3 = '33333333-3333-4333-8333-333333333333'

type Row = {
  id: string
  listing_id: string
  name: string
  role: string | null
  bio: string | null
  photo_path: string | null
  is_founder: boolean
  sort_order: number
}

const h = vi.hoisted(() => {
  const state = {
    user: null as { id: string } | null,
    listing: null as Record<string, unknown> | null,
    rows: [] as Row[],
    objects: [] as { name: string }[],
    writeFails: false,
    growthOpen: false,
    premiumOpen: false,
  }
  const removed: string[][] = []
  const writes: { op: string; payload?: Record<string, unknown> }[] = []
  let nextId = 1

  function teamQuery() {
    let op: 'select' | 'insert' | 'delete' | 'update' = 'select'
    let payload: Record<string, unknown> = {}
    const eqs: Record<string, unknown> = {}
    const neqs: Record<string, unknown> = {}
    let single = false
    const matches = (r: Row) =>
      Object.entries(eqs).every(([k, v]) => (r as Record<string, unknown>)[k] === v) &&
      Object.entries(neqs).every(([k, v]) => (r as Record<string, unknown>)[k] !== v)
    const run = () => {
      if (op !== 'select' && state.writeFails) return { data: null, error: { message: 'denied' } }
      if (op === 'select') {
        const data = state.rows.filter(matches).sort((a, b) => a.sort_order - b.sort_order)
        return { data, error: null }
      }
      writes.push({ op, payload })
      if (op === 'insert') {
        const row = {
          id: `00000000-0000-4000-8000-00000000000${nextId++}`,
          role: null,
          bio: null,
          photo_path: null,
          is_founder: false,
          sort_order: 0,
          ...payload,
        } as Row
        if (
          row.is_founder &&
          state.rows.some((r) => r.listing_id === row.listing_id && r.is_founder)
        ) {
          return { data: null, error: { message: 'duplicate founder' } }
        }
        state.rows.push(row)
        return { data: null, error: null }
      }
      if (op === 'delete') {
        const gone = state.rows.filter(matches)
        state.rows = state.rows.filter((r) => !matches(r))
        return { data: single ? (gone[0] ?? null) : gone, error: null }
      }
      for (const r of state.rows.filter(matches)) Object.assign(r, payload)
      return { data: null, error: null }
    }
    const q = {
      select: () => q,
      order: () => q,
      eq: (col: string, val: unknown) => {
        eqs[col] = val
        return q
      },
      neq: (col: string, val: unknown) => {
        neqs[col] = val
        return q
      },
      insert: (row: Record<string, unknown>) => {
        op = 'insert'
        payload = row
        return q
      },
      update: (row: Record<string, unknown>) => {
        op = 'update'
        payload = row
        return q
      },
      delete: () => {
        op = 'delete'
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        return resolve(run())
      },
    }
    return q
  }

  function makeUserClient() {
    return {
      from(table: string) {
        if (table === 'listing_team_members') return teamQuery()
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({ data: state.listing, error: null }),
        }
        return builder
      },
    }
  }

  const storage = {
    list: vi.fn(async (_folder: string, opts?: { search?: string }) => ({
      data: state.objects.filter((o) => !opts?.search || o.name.includes(opts.search)),
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => {
      removed.push(paths)
      return { data: [], error: null }
    }),
  }

  return {
    state,
    removed,
    writes,
    resetIds: () => {
      nextId = 1
    },
    createClient: vi.fn(async () => makeUserClient()),
    createServiceClient: vi.fn(() => ({ storage: { from: () => storage } })),
    getOwnerSession: vi.fn(async () => (state.user ? { user: state.user } : null)),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))
vi.mock('@/lib/marketplace/entitlements', () => ({
  teamOffers: async () => ({ growthOpen: h.state.growthOpen, premiumOpen: h.state.premiumOpen }),
}))

import {
  TEAM_BIO_MAX,
  TEAM_NAME_MAX,
  TEAM_ROLE_MAX,
  isUploadedTeamPhotoPath,
  parseTeamMember,
  toOwnerTeam,
  toPublicTeam,
  type OwnerTeamMember,
} from '@/lib/listings/team'
import { checkTeamAdd, teamUpgradeTarget } from '@/lib/stripe/planChecks'
import { teamMemberLimit } from '@/lib/stripe/features'
import {
  deleteTeamMemberAction,
  reorderTeamAction,
  saveTeamMemberAction,
} from '@/lib/actions/dashboard/team'

function read(file: string): string {
  return readFileSync(join(__dirname, '..', file), 'utf8')
}

function row(id: string, sort_order: number, extra: Partial<Row> = {}): Row {
  return {
    id,
    listing_id: LISTING_ID,
    name: `Person ${sort_order}`,
    role: null,
    bio: null,
    photo_path: null,
    is_founder: false,
    sort_order,
    ...extra,
  }
}

function member(
  id: string,
  sort_order: number,
  extra: Partial<OwnerTeamMember> = {}
): OwnerTeamMember {
  const { listing_id: _ignored, ...rest } = row(id, sort_order)
  return { ...rest, ...extra }
}

function setTier(tier: string) {
  h.state.listing = { ...h.state.listing, tier }
}

const ADD = {
  listingId: LISTING_ID,
  name: 'Maya Johnson',
  role: 'Head Baker',
  bio: '',
  isFounder: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  h.removed.length = 0
  h.writes.length = 0
  h.resetIds()
  h.state.user = { id: 'u1' }
  h.state.listing = {
    id: LISTING_ID,
    slug: 'cafe',
    status: 'published',
    entity_type: 'business',
    tier: 'growth',
    cities: { slug: 'atlanta' },
  }
  h.state.rows = []
  h.state.objects = [{ name: PHOTO_NAME }]
  h.state.writeFails = false
  h.state.growthOpen = false
  h.state.premiumOpen = false
})

// ── Rules ────────────────────────────────────────────────────────────────────

describe('parseTeamMember', () => {
  it('collapses the name and role to one line and trims the bio', () => {
    const r = parseTeamMember({
      name: '  Maya \n Johnson ',
      role: ' Head\tBaker ',
      bio: '  Hi.  ',
      isFounder: true,
    })
    expect(r).toEqual({
      ok: true,
      value: { name: 'Maya Johnson', role: 'Head Baker', bio: 'Hi.', is_founder: true },
    })
  })

  it('stores empty role and bio as null, and only true marks a founder', () => {
    const r = parseTeamMember({ name: 'Maya', role: '  ', bio: '', isFounder: 'yes' })
    expect(r).toEqual({
      ok: true,
      value: { name: 'Maya', role: null, bio: null, is_founder: false },
    })
  })

  it('needs a name and keeps each field to its limit', () => {
    expect(parseTeamMember({ name: ' ', role: '', bio: '', isFounder: false })).toEqual({
      ok: false,
      error: 'Add a name.',
    })
    expect(
      parseTeamMember({ name: 'x'.repeat(TEAM_NAME_MAX + 1), role: '', bio: '', isFounder: false })
    ).toMatchObject({ ok: false, error: `Keep the name to ${TEAM_NAME_MAX} characters.` })
    expect(
      parseTeamMember({ name: 'A', role: 'x'.repeat(TEAM_ROLE_MAX + 1), bio: '', isFounder: false })
    ).toMatchObject({ ok: false, error: `Keep the role to ${TEAM_ROLE_MAX} characters.` })
    expect(
      parseTeamMember({ name: 'A', role: '', bio: 'x'.repeat(TEAM_BIO_MAX + 1), isFounder: false })
    ).toMatchObject({ ok: false, error: `Keep the bio to ${TEAM_BIO_MAX} characters.` })
    expect(
      parseTeamMember({
        name: 'x'.repeat(TEAM_NAME_MAX),
        role: '',
        bio: 'x'.repeat(TEAM_BIO_MAX),
        isFounder: false,
      }).ok
    ).toBe(true)
  })
})

describe('isUploadedTeamPhotoPath', () => {
  it('accepts only this page’s uploaded team photos', () => {
    expect(isUploadedTeamPhotoPath(LISTING_ID, PHOTO)).toBe(true)
    expect(isUploadedTeamPhotoPath(LISTING_ID, OLD_PHOTO)).toBe(true)
    expect(isUploadedTeamPhotoPath(OTHER_ID, PHOTO)).toBe(false)
    expect(isUploadedTeamPhotoPath(LISTING_ID, PHOTO.replace('/team/', '/post/'))).toBe(false)
    expect(isUploadedTeamPhotoPath(LISTING_ID, PHOTO.replace('.jpg', '.gif'))).toBe(false)
    expect(isUploadedTeamPhotoPath(LISTING_ID, `listings/${LISTING_ID}/team/../x.jpg`)).toBe(false)
    expect(isUploadedTeamPhotoPath(LISTING_ID, null)).toBe(false)
    expect(isUploadedTeamPhotoPath('not-a-uuid', PHOTO)).toBe(false)
  })
})

describe('toOwnerTeam / toPublicTeam', () => {
  it('drops bad rows and sorts by the owner’s order', () => {
    const team = toOwnerTeam([
      row(M2, 1),
      { id: 7, name: 'x' },
      { id: M3, name: '  ' },
      row(M1, 0, { role: ' ', photo_path: '' }),
    ])
    expect(team.map((m) => m.id)).toEqual([M1, M2])
    expect(team[0]).toMatchObject({ role: null, photo_path: null, is_founder: false })
    expect(toOwnerTeam(null)).toEqual([])
  })

  it('shows the first ones the plan allows, with decorative photos', () => {
    const members = [
      member(M1, 0, { photo_path: PHOTO, is_founder: true, name: ' Maya ' }),
      member(M2, 1),
      member(M3, 2),
    ]
    const shown = toPublicTeam(members, 2, (p) => `https://cdn/${p}`)
    expect(shown.map((m) => m.id)).toEqual([M1, M2])
    expect(shown[0]).toEqual({
      id: M1,
      name: 'Maya',
      role: null,
      bio: null,
      photo: { src: `https://cdn/${PHOTO}`, alt: '' },
      isFounder: true,
    })
    expect(shown[1]?.photo).toBeNull()
    expect(toPublicTeam(members, null, () => null)).toHaveLength(3)
    expect(toPublicTeam(members, 0, () => null)).toEqual([])
  })
})

describe('the plan', () => {
  it('Growth shows 5, Premium any number, below Growth none', () => {
    expect(teamMemberLimit('free')).toBe(0)
    expect(teamMemberLimit('starter')).toBe(0)
    expect(teamMemberLimit('growth')).toBe(5)
    expect(teamMemberLimit('premium')).toBeNull()
  })

  it('checkTeamAdd says why an add is refused', () => {
    expect(checkTeamAdd('free', 0, true)).toBe(
      'Team members are part of Growth. Upgrade to add your team to your page.'
    )
    expect(checkTeamAdd('starter', 0, false)).toBe(
      'Team members come with Growth, which isn’t open yet.'
    )
    expect(checkTeamAdd('growth', 4)).toBeNull()
    expect(checkTeamAdd('growth', 5)).toBe(
      'Your plan includes 5 team members. Remove one to add another.'
    )
    expect(checkTeamAdd('growth', 5, false, true)).toBe(
      'Your plan includes 5 team members. Remove one, or upgrade to Premium for more.'
    )
    expect(checkTeamAdd('premium', 500)).toBeNull()
  })

  it('teamUpgradeTarget offers Growth below it and Premium on Growth, only when open', () => {
    expect(teamUpgradeTarget('free', true)).toBe('Growth')
    expect(teamUpgradeTarget('starter', true)).toBe('Growth')
    expect(teamUpgradeTarget('starter', false)).toBeNull()
    expect(teamUpgradeTarget('growth', false, true)).toBe('Premium')
    expect(teamUpgradeTarget('growth', false, false)).toBeNull()
    expect(teamUpgradeTarget('premium', true, true)).toBeNull()
  })
})

// ── Actions ──────────────────────────────────────────────────────────────────

describe('saveTeamMemberAction', () => {
  it('adds a member at the end of the list', async () => {
    h.state.rows = [row(M1, 0), row(M2, 3)]
    const r = await saveTeamMemberAction(ADD)
    expect(r).toMatchObject({ success: true })
    const added = h.state.rows.find((x) => x.name === 'Maya Johnson')
    expect(added).toMatchObject({
      listing_id: LISTING_ID,
      role: 'Head Baker',
      bio: null,
      sort_order: 4,
    })
  })

  it('refuses a signed-out owner, a bad id and a job page', async () => {
    h.state.user = null
    expect(await saveTeamMemberAction(ADD)).toEqual({ error: 'Please sign in again.' })
    h.state.user = { id: 'u1' }
    expect(await saveTeamMemberAction({ ...ADD, listingId: 'x' })).toEqual({
      error: 'Page not found, or you can’t edit it.',
    })
    h.state.listing = { ...h.state.listing, entity_type: 'job' }
    expect(await saveTeamMemberAction(ADD)).toEqual({
      error: 'Page not found, or you can’t edit it.',
    })
    expect(h.writes).toEqual([])
  })

  it('refuses an add below Growth, and offers Growth to a Free page when it is open', async () => {
    setTier('free')
    expect(await saveTeamMemberAction(ADD)).toEqual({
      error: 'Team members come with Growth, which isn’t open yet.',
    })
    h.state.growthOpen = true
    expect(await saveTeamMemberAction(ADD)).toEqual({
      error: 'Team members are part of Growth. Upgrade to add your team to your page.',
    })
    expect(h.writes).toEqual([])
  })

  it('refuses a sixth member on Growth, and allows it on Premium', async () => {
    h.state.rows = [0, 1, 2, 3, 4].map((i) => row(`0000000${i}-0000-4000-8000-000000000000`, i))
    expect(await saveTeamMemberAction(ADD)).toEqual({
      error: 'Your plan includes 5 team members. Remove one to add another.',
    })
    setTier('premium')
    expect(await saveTeamMemberAction(ADD)).toMatchObject({ success: true })
    expect(h.state.rows).toHaveLength(6)
  })

  it('still edits a member on a page that moved down a plan', async () => {
    setTier('starter')
    h.state.rows = [row(M1, 0)]
    const r = await saveTeamMemberAction({ ...ADD, id: M1, name: 'New Name' })
    expect(r).toMatchObject({ success: true })
    expect(h.state.rows[0]?.name).toBe('New Name')
  })

  it('refuses a member that is not on this page', async () => {
    h.state.rows = [row(M1, 0)]
    expect(await saveTeamMemberAction({ ...ADD, id: M2 })).toEqual({
      error: 'Team member not found.',
    })
    expect(await saveTeamMemberAction({ ...ADD, id: 'nope' })).toEqual({
      error: 'Team member not found.',
    })
  })

  it('moves the founder mark: the old founder is cleared first', async () => {
    h.state.rows = [row(M1, 0, { is_founder: true }), row(M2, 1)]
    const r = await saveTeamMemberAction({ ...ADD, id: M2, isFounder: true })
    expect(r).toMatchObject({ success: true })
    expect(h.state.rows.find((x) => x.id === M1)?.is_founder).toBe(false)
    expect(h.state.rows.find((x) => x.id === M2)?.is_founder).toBe(true)
    expect(h.writes[0]).toEqual({ op: 'update', payload: { is_founder: false } })
  })

  it('takes a photo only from this page’s team folder, and only when it was uploaded', async () => {
    expect(
      await saveTeamMemberAction({ ...ADD, photoPath: `listings/${OTHER_ID}/team/${PHOTO_NAME}` })
    ).toEqual({
      error: 'We couldn’t find that photo. Please upload it again.',
    })
    h.state.objects = []
    expect(await saveTeamMemberAction({ ...ADD, photoPath: PHOTO })).toEqual({
      error: 'We couldn’t find that photo. Please upload it again.',
    })
    h.state.objects = [{ name: PHOTO_NAME }]
    expect(await saveTeamMemberAction({ ...ADD, photoPath: PHOTO })).toMatchObject({
      success: true,
    })
    expect(h.state.rows[0]?.photo_path).toBe(PHOTO)
  })

  it('removes the old photo when it is replaced or removed, and keeps it otherwise', async () => {
    h.state.rows = [row(M1, 0, { photo_path: OLD_PHOTO })]
    await saveTeamMemberAction({ ...ADD, id: M1 })
    expect(h.removed).toEqual([])
    expect(h.state.rows[0]?.photo_path).toBe(OLD_PHOTO)

    await saveTeamMemberAction({ ...ADD, id: M1, photoPath: PHOTO })
    expect(h.removed).toEqual([[OLD_PHOTO]])
    expect(h.state.rows[0]?.photo_path).toBe(PHOTO)

    await saveTeamMemberAction({ ...ADD, id: M1, photoPath: null })
    expect(h.removed).toEqual([[OLD_PHOTO], [PHOTO]])
    expect(h.state.rows[0]?.photo_path).toBeNull()
  })

  it('reports a failed write', async () => {
    h.state.writeFails = true
    expect(await saveTeamMemberAction(ADD)).toEqual({
      error: 'We couldn’t save your team. Please try again.',
    })
  })
})

describe('reorderTeamAction', () => {
  it('saves the new order, writing only the members that moved', async () => {
    h.state.rows = [row(M1, 0), row(M2, 1), row(M3, 2)]
    const r = await reorderTeamAction({ listingId: LISTING_ID, ids: [M1, M3, M2] })
    expect(r).toMatchObject({ success: true })
    if (!('success' in r)) throw new Error('expected success')
    expect(r.members.map((m) => m.id)).toEqual([M1, M3, M2])
    expect(h.writes).toHaveLength(2)
  })

  it('refuses a list that is not exactly the page’s members', async () => {
    h.state.rows = [row(M1, 0), row(M2, 1)]
    const stale = { error: 'Your team changed in another tab. Reload the page and try again.' }
    expect(await reorderTeamAction({ listingId: LISTING_ID, ids: [M1] })).toEqual(stale)
    expect(await reorderTeamAction({ listingId: LISTING_ID, ids: [M1, M1] })).toEqual(stale)
    expect(await reorderTeamAction({ listingId: LISTING_ID, ids: [M1, M3] })).toEqual(stale)
    expect(await reorderTeamAction({ listingId: LISTING_ID, ids: 'x' })).toEqual(stale)
    expect(h.writes).toEqual([])
  })

  it('works on every plan', async () => {
    setTier('free')
    h.state.rows = [row(M1, 0), row(M2, 1)]
    expect(await reorderTeamAction({ listingId: LISTING_ID, ids: [M2, M1] })).toMatchObject({
      success: true,
    })
  })
})

describe('deleteTeamMemberAction', () => {
  it('removes the member and their photo, on every plan', async () => {
    setTier('free')
    h.state.rows = [row(M1, 0, { photo_path: PHOTO }), row(M2, 1)]
    const r = await deleteTeamMemberAction({ listingId: LISTING_ID, id: M1 })
    expect(r).toMatchObject({ success: true })
    expect(h.state.rows.map((x) => x.id)).toEqual([M2])
    expect(h.removed).toEqual([[PHOTO]])
  })

  it('refuses a bad id before reading anything', async () => {
    expect(await deleteTeamMemberAction({ listingId: LISTING_ID, id: 'x' })).toEqual({
      error: 'Team member not found.',
    })
    expect(h.createClient).not.toHaveBeenCalled()
  })
})

// ── Wiring ───────────────────────────────────────────────────────────────────

describe('migration 20261120000000_listing_team_members', () => {
  const sql = read('supabase/migrations/20261120000000_listing_team_members.sql')

  it('keeps the limits the app checks', () => {
    expect(sql).toContain(`BETWEEN 1 AND ${TEAM_NAME_MAX})`)
    expect(sql).toContain(`BETWEEN 1 AND ${TEAM_ROLE_MAX})`)
    expect(sql).toContain(`BETWEEN 1 AND ${TEAM_BIO_MAX})`)
    expect(sql).toContain("LIKE 'listings/' || listing_id::text || '/team/%'")
    expect(sql).toMatch(/UNIQUE INDEX[^;]+\(listing_id\)\s+WHERE is_founder/)
  })

  it('lets the public read only published pages, and only owners write', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    const anon = sql.slice(
      sql.indexOf('"listing_team_members: anon read" ON'),
      sql.indexOf('-- Authenticated')
    )
    expect(anon).toContain("status = 'published' AND deleted_at IS NULL")
    for (const op of ['insert', 'update', 'delete']) {
      const at = sql.indexOf(`CREATE POLICY "listing_team_members: owner ${op}"`)
      expect(at).toBeGreaterThan(0)
      expect(sql.slice(at, at + 600)).toContain('owner_user_id = auth.uid()')
    }
  })

  it('has a down plan', () => {
    expect(sql).toMatch(/Down:\s*\n--\s+DROP TABLE IF EXISTS public\.listing_team_members;/)
  })
})

describe('wiring', () => {
  it('the loader reads the team fail-soft, Growth+ business pages only, capped by plan', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain(".from('listing_team_members')")
    expect(src).toContain("canAccess(listing.tier, 'team_members')")
    expect(src).toContain(
      'toPublicTeam(await teamPromise, teamMemberLimit(raw.tier), resolveMediaPath)'
    )
    expect(src).toContain('(error ? [] : toOwnerTeam(data))')
  })

  it('the dashboard has a Team page and link, and photos upload with media_role=team', () => {
    expect(read('lib/account/shellNav.ts')).toContain(
      "{ href: `/dashboard/pages/${pageId}/team`, label: 'Team' }"
    )
    expect(read('app/dashboard/pages/[entityId]/team/page.tsx')).toContain('<TeamManager')
    expect(read('components/dashboard/TeamManager.tsx')).toContain(
      "fd.append('media_role', 'team')"
    )
    expect(read('app/api/upload/route.ts')).toContain("'team'")
  })

  it('team photos never count toward the plan’s photos', () => {
    const src = read('lib/media/storeListingImage.ts')
    expect(src).toContain("const isGallery = role === 'gallery'")
  })
})
