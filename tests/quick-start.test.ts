// =============================================================================
// lib/listings/quickStart.ts: the /add-business quick start (ticket 126)
// =============================================================================
// The "Not quite" layers must always end at the 13 groups and then "Suggest a
// new category", even when the owner's words match nothing (henna). "Save my
// draft" must name the first missing thing so the screen can focus it.
// Categories come from supabase/seed.sql, like tests/sorting-guide.test.ts.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

import { GUIDE_ANSWERS, type GuideCategory } from '@/lib/categories/sorting-guide'
import {
  EMPTY_ANSWERS,
  QUICK_STEPS,
  type FitLayer,
  type QuickStartAnswers,
  ctaValueProblem,
  ctasFor,
  defaultRequestParent,
  findCta,
  fitCategoryId,
  fitOptions,
  firstFitLayer,
  firstMissing,
  locationLabel,
  nextFitLayer,
  pickFor,
  quickStartMode,
  stepForServerField,
  stepProblem,
  whereLocationType,
} from '@/lib/listings/quickStart'

const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')
const ROW = /\('([0-9a-f-]+)',\s*'((?:[^']|'')*)',\s*'([a-z0-9-]+)',\s*(NULL|'[0-9a-f-]+'),/g
const CATS: GuideCategory[] = [...seed.matchAll(ROW)].map((m) => ({
  id: m[1] ?? '',
  name: (m[2] ?? '').replace(/''/g, "'"),
  slug: m[3] ?? '',
  parent_id: m[4] === 'NULL' ? null : (m[4] ?? '').slice(1, -1),
}))

function walk(query: string): FitLayer[] {
  const options = fitOptions(query, CATS)
  const layers: FitLayer[] = [firstFitLayer(options)]
  while (layers[layers.length - 1] !== 'suggest') {
    layers.push(nextFitLayer(layers[layers.length - 1] as FitLayer, options))
    if (layers.length > 6) throw new Error('the layers never end')
  }
  return layers
}

const COMPLETE: QuickStartAnswers = {
  ...EMPTY_ANSWERS,
  ownership: 'black_owned',
  name: 'Fade Lab',
  about: 'Classic cuts and fades in a calm shop. Walk-ins welcome.',
  fit: { kind: 'category', categoryId: CATS.find((c) => c.parent_id)?.id ?? '' },
  where: 'visit',
  cityId: '00000000-0000-0000-0000-000000000001',
  ctaType: 'book',
  ctaUrl: 'https://cal.com/fadelab',
  attested: true,
}

describe('"Not quite" layers', () => {
  it('a match starts with one pick and ends at the groups, then suggest', () => {
    const layers = walk('Fade Lab barber shop cuts and fades')
    expect(layers[0]).toBe('best')
    expect(layers.slice(-2)).toEqual(['groups', 'suggest'])
  })

  it('a no-match query (henna) starts at the groups, then suggest', () => {
    const options = fitOptions('Mehndi by Amara henna', CATS)
    expect(options.best).toBeNull()
    expect(walk('Mehndi by Amara henna')).toEqual(['groups', 'suggest'])
  })

  it('a blank query still reaches the groups and suggest', () => {
    expect(walk('')).toEqual(['groups', 'suggest'])
  })

  it('shows at most two more after the first pick', () => {
    const options = fitOptions('lawyer attorney law firm', CATS)
    expect(options.best).not.toBeNull()
    expect(options.more.length).toBeLessThanOrEqual(2)
    expect(options.more.map((c) => c.id)).not.toContain(options.best?.id)
  })

  it('the groups are the 13 guide answers', () => {
    const { groups } = fitOptions('', CATS)
    expect(groups).toHaveLength(13)
    expect(groups.map((g) => g.id)).toEqual(GUIDE_ANSWERS.map((a) => a.id))
  })

  it('the request parent choices are the top-level categories', () => {
    const { parents } = fitOptions('', CATS)
    expect(parents.length).toBeGreaterThanOrEqual(13)
    expect(parents.every((p) => p.parent_id === null)).toBe(true)
  })
})

describe('new category requests', () => {
  it('default to the best match group', () => {
    const options = fitOptions('barber', CATS)
    const parent = defaultRequestParent(options, CATS)
    expect(CATS.find((c) => c.id === parent)?.parent_id).toBeNull()
  })

  it('default to the tapped group when nothing matched', () => {
    const options = fitOptions('henna', CATS)
    expect(defaultRequestParent(options, CATS)).toBe('')
    const parent = defaultRequestParent(options, CATS, 'beauty')
    expect(parent).not.toBe('')
  })

  it('save the listing under the closest group', () => {
    expect(
      fitCategoryId({ kind: 'request', parentId: 'p1', proposedName: 'Henna', words: '' })
    ).toBe('p1')
  })

  it('need a proposed name', () => {
    const a: QuickStartAnswers = {
      ...COMPLETE,
      fit: { kind: 'request', parentId: 'p1', proposedName: ' ', words: '' },
    }
    expect(stepProblem('fit', a)?.fieldId).toBe('qs-request-name')
  })
})

describe('Save my draft', () => {
  it('names nothing when every step is done', () => {
    expect(firstMissing(COMPLETE)).toBeNull()
  })

  it('names the first missing step in order', () => {
    expect(firstMissing(EMPTY_ANSWERS)?.step).toBe('ownership')
    expect(firstMissing({ ...COMPLETE, about: 'Cuts' })?.step).toBe('about')
    expect(firstMissing({ ...COMPLETE, attested: false })?.step).toBe('attest')
  })

  it('an empty one line is fine (it comes from the about text)', () => {
    expect(stepProblem('tagline', { ...COMPLETE, tagline: '' })).toBeNull()
    expect(stepProblem('tagline', { ...COMPLETE, tagline: 'Hi' })?.step).toBe('tagline')
  })

  it('online needs no city, a place does', () => {
    expect(stepProblem('where', { ...COMPLETE, where: 'online', cityId: '' })).toBeNull()
    expect(stepProblem('where', { ...COMPLETE, cityId: '' })?.fieldId).toBe('qs-city')
    expect(stepProblem('where', { ...COMPLETE, cityId: '', cityText: 'Macon' })).toBeNull()
  })

  it('every step has a check', () => {
    for (const step of QUICK_STEPS)
      expect(stepProblem(step, EMPTY_ANSWERS)?.step ?? step).toBe(step)
  })
})

describe('the main button value', () => {
  it('follows the same rules as the server', () => {
    expect(ctaValueProblem('message', 'owner@example.com')).toBeNull()
    expect(ctaValueProblem('message', 'nope')).not.toBeNull()
    expect(ctaValueProblem('call', '(404) 555-0100')).toBeNull()
    expect(ctaValueProblem('book', 'cal.com/x')).not.toBeNull()
    expect(ctaValueProblem('book', 'https://cal.com/x')).toBeNull()
    expect(ctaValueProblem('', 'https://x.com')).not.toBeNull()
  })
})

describe('server field errors', () => {
  it('map to the step that asks for them', () => {
    expect(stepForServerField('founder_story')).toBe('about')
    expect(stepForServerField('category_request_name')).toBe('fit')
    expect(stepForServerField('city_id')).toBe('where')
    expect(stepForServerField('cta_url')).toBe('cta')
    expect(stepForServerField('social_instagram')).toBeNull()
  })
})

describe('the live page', () => {
  const cities = [{ id: 'c1', name: 'Atlanta', stateCode: 'GA' }]
  it('labels the place', () => {
    expect(
      locationLabel({ where: 'visit', cityId: 'c1', cityText: '', stateText: '' }, cities)
    ).toBe('Atlanta, GA')
    expect(
      locationLabel({ where: 'online', cityId: '', cityText: '', stateText: '' }, cities)
    ).toBe('Online')
    expect(
      locationLabel({ where: 'visit', cityId: '', cityText: 'Macon', stateText: 'GA' }, cities)
    ).toBe('Macon, GA')
    expect(locationLabel({ where: '', cityId: '', cityText: '', stateText: '' }, cities)).toBeNull()
  })

  it('a pop-up seller lists as a Vendor', () => {
    const pick = pickFor({ ...COMPLETE, where: 'popups' }, CATS)
    expect(pick?.entityType).toBe('vendor')
  })
})

// Ticket 132: creators use the same quick start through /add-business?as=creator.
describe('creator mode', () => {
  const done: QuickStartAnswers = {
    ...EMPTY_ANSWERS,
    ownership: 'black_owned',
    name: 'Jane Doe',
    about: 'I talk about money for first-generation earners.',
    fit: { kind: 'category', categoryId: 'pod' },
    ctaType: 'subscribe',
    ctaUrl: 'https://www.instagram.com/janedoe',
    attested: true,
    ageAttested: true,
  }

  it('turns on only for as=creator', () => {
    expect(quickStartMode('creator')).toBe('creator')
    expect(quickStartMode(undefined)).toBe('business')
    expect(quickStartMode('business')).toBe('business')
    expect(quickStartMode(['creator'])).toBe('business')
  })

  it('offers Message, Follow and Work with me', () => {
    expect(ctasFor('creator').map((c) => c.label)).toEqual(['Message', 'Follow', 'Work with me'])
    expect(ctasFor('business').map((c) => c.value)).not.toContain('inquire')
  })

  it('finds creator buttons only in creator mode', () => {
    expect(findCta('inquire', 'creator')?.labelOverride).toBe('Work with me')
    expect(findCta('inquire')).toBeUndefined()
    expect(findCta('call', 'creator')).toBeUndefined()
  })

  it('a finished creator has nothing missing, with no city', () => {
    expect(firstMissing(done, 'creator')).toBeNull()
  })

  it('needs the 18 or older check after "this page is about me"', () => {
    expect(stepProblem('attest', { ...done, attested: false }, 'creator')?.reason).toBe(
      'Confirm this page is about you.'
    )
    const age = stepProblem('attest', { ...done, ageAttested: false }, 'creator')
    expect(age?.fieldId).toBe('qs-age')
    expect(age?.reason).toContain('18')
  })

  it('a business never needs the age check', () => {
    expect(stepProblem('attest', { ...done, ageAttested: false })).toBeNull()
  })

  it('words problems for a person', () => {
    expect(stepProblem('ownership', { ...done, ownership: '' } as QuickStartAnswers, 'creator')?.reason).toBe(
      'Pick Black Creator or Ally Creator.'
    )
    expect(stepProblem('name', { ...done, name: '' }, 'creator')?.reason).toBe(
      'Add the name people know you by.'
    )
    expect(stepProblem('fit', { ...done, fit: null }, 'creator')?.reason).toBe(
      'Pick what you make most.'
    )
  })

  it('checks the creator button value', () => {
    expect(ctaValueProblem('message', 'not-an-email', 'creator')).toBe('Enter a valid email address.')
    expect(ctaValueProblem('message', 'hi@jane.com', 'creator')).toBeNull()
  })

  it('maps the age error to the last step', () => {
    expect(stepForServerField('age_attested')).toBe('attest')
    expect(stepForServerField('ownership_attested')).toBe('attest')
  })

  it('lists a creator online, with or without a city', () => {
    expect(whereLocationType('', 'creator')).toBe('virtual')
    expect(locationLabel({ where: '', cityId: '', cityText: '', stateText: '' }, [], 'creator')).toBe(
      'Online'
    )
    expect(
      locationLabel({ where: '', cityId: '', cityText: 'Atlanta', stateText: 'GA' }, [], 'creator')
    ).toBe('Atlanta, GA')
  })
})
