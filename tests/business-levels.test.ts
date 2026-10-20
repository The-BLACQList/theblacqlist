// =============================================================================
// Business levels: Growers, Makers, Suppliers, Local businesses
// =============================================================================
// Spec: docs/blacqlist/product/business-levels-2026-10.md.
// [Decision — founder, 2026-10-16] four levels matching The Collective, one
// main level plus extras, a separate filter whose default comes from the
// category, and a card pill only for Grower, Maker or Supplier.
//
// The migration itself was checked against a local scratch database; these
// cases guard the app side: the rules mirror the database CHECKs, a level
// filter never widens to the whole directory, the owner's role question only
// shows when it matters, and Local never gets a pill.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

import {
  BUSINESS_LEVELS,
  LEVEL_META,
  extraLevelLabels,
  levelPill,
  levelsForCategory,
  validateLevels,
} from '@/lib/listings/levels'
import { levelFilterHref } from '@/lib/listings/url'
import { attachLevels, loadCategoryLevels } from '@/lib/listings/levelRows'
import { searchSchema } from '@/lib/validations/search'
import { hasUnresolved, resolveFacetParams, rpcArgs } from '@/lib/listings/facets'
import {
  EMPTY_ANSWERS,
  QUICK_STEPS,
  adjacentStepIndex,
  chosenLevel,
  firstMissing,
  roleOptions,
  stepApplies,
  stepForServerField,
  visibleSteps,
  type QuickCategory,
} from '@/lib/listings/quickStart'

const src = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('levels', () => {
  it('are the four Collective levels, in order', () => {
    expect(BUSINESS_LEVELS).toEqual(['grower', 'maker', 'supplier', 'local'])
  })

  it('give a pill to grower, maker and supplier only', () => {
    expect(levelPill('grower')).toBe('Grower')
    expect(levelPill('maker')).toBe('Maker')
    expect(levelPill('supplier')).toBe('Supplier')
    expect(levelPill('local')).toBeNull()
    expect(levelPill(null)).toBeNull()
    expect(levelPill('wholesaler')).toBeNull()
  })

  it('use plain copy with no em dashes', () => {
    for (const meta of Object.values(LEVEL_META)) {
      for (const text of Object.values(meta)) {
        if (typeof text === 'string') expect(text).not.toContain('—')
      }
    }
  })

  it('list extras in canonical order and drop unknowns', () => {
    expect(extraLevelLabels(['supplier', 'grower', 'nope'])).toEqual(['Grower', 'Supplier'])
    expect(extraLevelLabels(null)).toEqual([])
  })

  it('link a level to the discover filter, never for local', () => {
    expect(levelFilterHref('maker')).toBe('/discover?level=maker')
    expect(levelFilterHref('local')).toBeNull()
    expect(levelFilterHref(undefined)).toBeNull()
  })
})

describe('levelsForCategory', () => {
  it('reads the row as stored, in canonical order', () => {
    expect(
      levelsForCategory({ default_level: 'maker', allowed_levels: ['local', 'maker', 'supplier'] })
    ).toEqual({ default_level: 'maker', allowed_levels: ['maker', 'supplier', 'local'] })
  })

  it('falls back to local only for a missing or malformed row', () => {
    const local = { default_level: 'local', allowed_levels: ['local'] }
    expect(levelsForCategory(null)).toEqual(local)
    expect(levelsForCategory({ default_level: null, allowed_levels: null })).toEqual(local)
    expect(levelsForCategory({ default_level: 'x', allowed_levels: ['bogus'] })).toEqual(local)
  })

  it('never returns a default the category does not allow', () => {
    expect(
      levelsForCategory({ default_level: 'grower', allowed_levels: ['supplier', 'local'] })
        .default_level
    ).toBe('supplier')
  })
})

describe('validateLevels (mirrors the database CHECKs)', () => {
  const allowed = ['maker', 'supplier', 'local'] as const

  it('accepts an allowed main level with allowed extras, de-duplicated', () => {
    expect(validateLevels('local', ['supplier', 'maker', 'supplier'], [...allowed])).toEqual({
      ok: true,
      primary: 'local',
      extras: ['maker', 'supplier'],
    })
  })

  it('refuses a main level the category does not allow', () => {
    expect(validateLevels('grower', [], [...allowed]).ok).toBe(false)
    expect(validateLevels('', [], [...allowed]).ok).toBe(false)
  })

  it('refuses an extra the category does not allow', () => {
    expect(validateLevels('local', ['grower'], [...allowed]).ok).toBe(false)
  })

  it('refuses the main level repeated as an extra', () => {
    expect(validateLevels('maker', ['maker'], [...allowed]).ok).toBe(false)
  })
})

describe('the level filter', () => {
  it('parses a multi-select level and refuses a typo instead of widening', () => {
    const ok = searchSchema.safeParse({ level: 'supplier,maker' })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.level).toEqual(['supplier', 'maker'])
    expect(searchSchema.safeParse({ level: 'suplier' }).success).toBe(false)
  })

  it('resolves to p_levels in canonical order, and null when absent', async () => {
    const stub = {} as unknown as Parameters<typeof resolveFacetParams>[0]
    const picked = await resolveFacetParams(stub, { level: ['supplier', 'grower'] })
    expect(picked.params.p_levels).toEqual(['grower', 'supplier'])
    const none = await resolveFacetParams(stub, {})
    expect(none.params.p_levels).toBeNull()
  })

  it('marks an unknown level unresolved so /discover comes back empty, not widened', async () => {
    const stub = {} as unknown as Parameters<typeof resolveFacetParams>[0]
    const typo = await resolveFacetParams(stub, { level: ['suplier'] })
    expect(typo.unresolved.levels).toEqual(['suplier'])
    expect(hasUnresolved(typo.unresolved)).toBe(true)
    const fine = await resolveFacetParams(stub, { level: ['maker'] })
    expect(hasUnresolved(fine.unresolved)).toBe(false)
  })

  it('drops a null p_levels so older functions get the call they know', () => {
    expect('p_levels' in rpcArgs({ p_query: 'x', p_levels: null })).toBe(false)
    expect(rpcArgs({ p_levels: ['maker'] }).p_levels).toEqual(['maker'])
  })

  it('never retries without p_levels', () => {
    expect(src('lib/listings/facets.ts')).toMatch(/'p_levels' in args \|\|\s*'p_open_to_partnerships' in args\s*\)\s*return first/)
  })
})

// ── Add a business: "What's your main role?" ─────────────────────────────────

const CATS: QuickCategory[] = [
  { id: 'c-handmade', name: 'Handmade & Artisan Goods', slug: 'handmade-artisan-goods', parent_id: 'p-retail', default_level: 'maker', allowed_levels: ['maker', 'supplier', 'local'] },
  { id: 'c-cpa', name: 'Accounting', slug: 'accounting', parent_id: 'p-pro', default_level: 'local', allowed_levels: ['local'] },
  { id: 'c-old', name: 'Before the migration', slug: 'old', parent_id: 'p-pro' },
]
const fitOf = (categoryId: string) => ({ kind: 'category' as const, categoryId })
const ROLE = QUICK_STEPS.indexOf('role')

describe('quick start role step', () => {
  it('sits right after the fit step', () => {
    expect(QUICK_STEPS[ROLE - 1]).toBe('fit')
  })

  it('shows only when the category allows more than one level', () => {
    expect(roleOptions({ fit: fitOf('c-handmade') }, CATS)?.allowed_levels).toEqual([
      'maker',
      'supplier',
      'local',
    ])
    expect(roleOptions({ fit: fitOf('c-cpa') }, CATS)).toBeNull()
    expect(roleOptions({ fit: fitOf('c-old') }, CATS)).toBeNull()
    expect(stepApplies('role', { fit: fitOf('c-cpa') }, CATS)).toBe(false)
    expect(stepApplies('name', { fit: fitOf('c-cpa') }, CATS)).toBe(true)
  })

  it('is skipped by Next and Back, and missing from the step count', () => {
    const a = { fit: fitOf('c-cpa') }
    expect(adjacentStepIndex(ROLE - 1, 1, a, CATS)).toBe(ROLE + 1)
    expect(adjacentStepIndex(ROLE + 1, -1, a, CATS)).toBe(ROLE - 1)
    expect(visibleSteps(a, CATS)).not.toContain('role')
    expect(visibleSteps({ fit: fitOf('c-handmade') }, CATS)).toContain('role')
    expect(adjacentStepIndex(ROLE - 1, 1, { fit: fitOf('c-handmade') }, CATS)).toBe(ROLE)
  })

  it('never steps past either end', () => {
    expect(adjacentStepIndex(0, -1, EMPTY_ANSWERS, CATS)).toBe(0)
    expect(adjacentStepIndex(QUICK_STEPS.length - 1, 1, EMPTY_ANSWERS, CATS)).toBe(
      QUICK_STEPS.length - 1
    )
  })

  it('saves the pick when allowed, else the category default', () => {
    const fit = fitOf('c-handmade')
    expect(chosenLevel({ fit, level: '' }, CATS)).toBe('maker')
    expect(chosenLevel({ fit, level: 'supplier' }, CATS)).toBe('supplier')
    expect(chosenLevel({ fit, level: 'grower' }, CATS)).toBe('maker')
    expect(chosenLevel({ fit: fitOf('c-cpa'), level: 'supplier' }, CATS)).toBe('local')
  })

  it('never blocks "Save my draft"', () => {
    const missing = firstMissing({ ...EMPTY_ANSWERS, fit: fitOf('c-handmade') })
    expect(missing?.step).not.toBe('role')
  })

  it('maps a server primary_level error to the role step', () => {
    expect(stepForServerField('primary_level')).toBe('role')
  })

  it('sends primary_level and the server falls back to the default', () => {
    expect(src('app/add-business/_components/quick-start/QuickStart.tsx')).toMatch(
      /fd\.set\('primary_level', level\)/
    )
    const action = src('lib/actions/listings/createListing.ts')
    expect(action).toMatch(/loadCategoryLevels\(supabase, \[category\.id\]\)/)
    expect(action).toMatch(/levelPick\?\.ok \? levelPick\.primary : catLevels\.default_level/)
    expect(action).toMatch(/primaryLevel \? \{ primary_level: primaryLevel \} : \{\}/)
  })
})

describe('surfaces', () => {
  it('the sidebar has a Level section under Type, outside More filters', () => {
    const s = src('components/discovery/FacetSidebar.tsx')
    expect(s).toMatch(/title="Level"/)
    expect(s).toMatch(/aria-label="Filter by level"/)
    expect(s.indexOf('title="Level"')).toBeGreaterThan(s.indexOf('title="Type"'))
    expect(s.indexOf('title="Level"')).toBeLessThan(s.indexOf('<MoreFilters'))
  })

  it('a level filter with no results says which level is missing', () => {
    const s = src('components/discovery/DiscoveryGrid.tsx')
    expect(s).toMatch(/function LevelEmptyState/)
    expect(s).toMatch(/listed yet/)
    expect(s).toMatch(/href="\/add-business"/)
  })

  it('the card and hero show a level pill from levelPill only', () => {
    expect(src('components/entities/EntityCard.tsx')).toMatch(/levelPill\(entity\.primary_level\)/)
    expect(src('components/entity-page/templates/TemplateHero.tsx')).toMatch(/levelPill\(/)
  })

  it('the owner editor saves levels outside the attribute limit', () => {
    const action = src('lib/actions/dashboard/updateListingLevels.ts')
    expect(action).toMatch(/validateLevels\(/)
    expect(action).toMatch(/\.eq\('owner_user_id', owner\.user\.id\)/)
    expect(action).not.toMatch(/checkAttributeCount/)
    expect(src('components/listings/PageFinishView.tsx')).toMatch(/<LevelSection/)
  })
})

// Staging and every Preview run without the level columns until GATE-DATA. A
// level column inside the main selects made PostgREST reject the whole query:
// /discover rendered 0 results and every business page 404'd. Levels are read
// apart and fail soft instead.
describe('works before the migration', () => {
  const missingColumn = {
    from: () => ({
      select: () => ({
        in: async () => ({ data: null, error: { code: '42703', message: 'column does not exist' } }),
      }),
    }),
  }
  const throwing = {
    from: () => {
      throw new Error('no in()')
    },
  }

  it('keeps level columns out of the main listing selects', () => {
    for (const file of ['lib/listings/query.ts', 'lib/listings/entityPage.ts']) {
      const s = src(file)
      const select = s.match(/(?:NESTED_SELECT|LISTING_SELECT) = `([\s\S]*?)`/)?.[1] ?? ''
      expect(select).toMatch(/ownership_label/)
      expect(select).not.toMatch(/primary_level|extra_levels/)
      expect(s).toMatch(/await attachLevels\(/)
    }
    expect(src('app/page.tsx')).toMatch(/await attachLevels\(supabase, freshFinds\)/)
  })

  it('keeps level columns out of the add-business category selects', () => {
    expect(src('app/add-business/page.tsx')).toMatch(/\.select\('id, name, slug, parent_id'\)/)
    expect(src('lib/actions/listings/createListing.ts')).toMatch(/\.select\('id, slug, parent_id'\)/)
  })

  it('attachLevels reads every card as local when the columns are missing', async () => {
    const cards: { id: string; primary_level?: string; extra_levels?: string[] }[] = [{ id: 'a' }, { id: 'b' }]
    await attachLevels(missingColumn, cards)
    expect(cards).toEqual([
      { id: 'a', primary_level: 'local', extra_levels: [], open_to_partnerships: false },
      { id: 'b', primary_level: 'local', extra_levels: [], open_to_partnerships: false },
    ])
    await attachLevels(throwing, cards)
    expect(cards[0]?.primary_level).toBe('local')
  })

  it('attachLevels applies stored levels and drops bad values', async () => {
    const client = {
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [
              { id: 'a', primary_level: 'maker', extra_levels: ['supplier', 'nope'], open_to_partnerships: true },
              { id: 'b', primary_level: 'bogus', extra_levels: null, open_to_partnerships: 'yes' },
            ],
            error: null,
          }),
        }),
      }),
    }
    const cards: { id: string; primary_level?: string; extra_levels?: string[] }[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    await attachLevels(client, cards)
    expect(cards).toEqual([
      { id: 'a', primary_level: 'maker', extra_levels: ['supplier'], open_to_partnerships: true },
      { id: 'b', primary_level: 'local', extra_levels: [], open_to_partnerships: false },
      { id: 'c', primary_level: 'local', extra_levels: [], open_to_partnerships: false },
    ])
  })

  it('loadCategoryLevels returns null (levels off) when the columns are missing', async () => {
    expect(await loadCategoryLevels(missingColumn, ['x'])).toBeNull()
    expect(await loadCategoryLevels(throwing, ['x'])).toBeNull()
  })
})
