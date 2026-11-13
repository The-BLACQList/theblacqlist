// Part C: "Import from my website" on the edit page. What is offered, what is
// ticked for the owner, and that only ticked, unlocked fields are sent.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SiteFindings } from '@/lib/import/read-site'
import type { WeeklyHours } from '@/types'
import {
  cardsFor,
  chunk,
  fitText,
  importRows,
  pairsFor,
  photoChoices,
  photoRoom,
  previewContact,
  withNameChoice,
  type ImportOptions,
  type PageNow,
} from '@/lib/import/ownerImport'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const day = (open = '09:00', close = '17:00', closed = false) => ({ open, close, closed })
const WEEK: WeeklyHours = {
  monday: day(),
  tuesday: day(),
  wednesday: day(),
  thursday: day(),
  friday: day(),
  saturday: day('10:00', '14:00'),
  sunday: day('', '', true),
}

function findings(over: Partial<SiteFindings> = {}): SiteFindings {
  return {
    sourceHost: 'glowsalon.com',
    isLinkInBio: false,
    name: 'Glow Salon',
    nameOptions: [],
    about: 'We do hair. We do it well.',
    phones: ['(404) 555-0100'],
    emails: ['hi@glowsalon.com'],
    address: { street: '12 Peach St', city: 'Atlanta', state: 'GA', zip: '30318' },
    hours: WEEK,
    socials: { instagram: 'https://instagram.com/glow' },
    website: 'https://glowsalon.com',
    photos: [],
    suggestedLogo: null,
    suggestedCover: null,
    siteText: null,
    ...over,
  }
}

const EMPTY: PageNow = {
  name: 'Glow Salon',
  description: null,
  phone: null,
  email: null,
  websiteUrl: null,
  addressLine1: null,
  state: null,
  zip: null,
  hours: null,
  socials: { instagram: null, facebook: null, twitter: null, tiktok: null, linkedin: null, youtube: null },
  locationLabel: 'Atlanta, GA',
}

const PAID: ImportOptions = { aboutLimit: null, socialsAllowed: true, hasHours: true }

const keys = (rows: { key: string }[]) => rows.map((r) => r.key)

describe('importRows', () => {
  it('offers each field the page is missing, ticked', () => {
    const rows = importRows(findings(), EMPTY, PAID)
    expect(keys(rows)).toEqual(['about', 'phone', 'email', 'website', 'address', 'hours', 'social:instagram'])
    expect(rows.every((r) => r.defaultChecked)).toBe(true)
  })

  it('skips what the page already says, however it is written', () => {
    const now: PageNow = {
      ...EMPTY,
      name: 'glow  salon',
      phone: '+1 404 555 0100',
      email: 'HI@glowsalon.com',
      websiteUrl: 'https://glowsalon.com/',
    }
    const rows = importRows(findings(), now, PAID)
    expect(keys(rows)).not.toContain('name')
    expect(keys(rows)).not.toContain('phone')
    expect(keys(rows)).not.toContain('email')
    expect(keys(rows)).not.toContain('website')
  })

  it('offers a different value unticked, showing what is there now', () => {
    const rows = importRows(findings(), { ...EMPTY, phone: '404-555-0199' }, PAID)
    const phone = rows.find((r) => r.key === 'phone')
    expect(phone?.defaultChecked).toBe(false)
    expect(phone?.current).toBe('404-555-0199')
  })

  it('shortens About to the plan limit and says so', () => {
    const about = 'First sentence here. Second sentence that is much longer than the rest.'
    const rows = importRows(findings({ about }), EMPTY, { ...PAID, aboutLimit: 30 })
    const row = rows.find((r) => r.key === 'about')
    expect(row?.found).toBe('First sentence here.')
    expect(row?.note).toMatch(/30 characters/)
  })

  it('locks social links on a plan without them, and never sends them', () => {
    const rows = importRows(findings(), EMPTY, { ...PAID, socialsAllowed: false })
    const ig = rows.find((r) => r.key === 'social:instagram')
    expect(ig?.locked).toMatch(/Starter/)
    expect(ig?.defaultChecked).toBe(false)
    const all = new Set(keys(rows))
    expect(pairsFor(rows, all).some(([k]) => k === 'social_instagram')).toBe(false)
    expect(cardsFor(rows, all)).not.toContain('social')
  })

  it('leaves out hours on a page with no hours card', () => {
    expect(keys(importRows(findings(), EMPTY, { ...PAID, hasHours: false }))).not.toContain('hours')
  })

  it('refuses addresses that are not https', () => {
    const rows = importRows(
      findings({ website: 'http://glowsalon.com', socials: { instagram: 'http://instagram.com/glow' } }),
      EMPTY,
      PAID
    )
    expect(keys(rows)).not.toContain('website')
    expect(keys(rows)).not.toContain('social:instagram')
  })

  it('keeps the page city, and notes a different one on the site', () => {
    const rows = importRows(
      findings({ address: { street: '9 Elm St', city: 'Decatur', state: null, zip: null } }),
      { ...EMPTY, state: 'GA', zip: '30318' },
      PAID
    )
    const address = rows.find((r) => r.key === 'address')
    expect(address?.pairs).toEqual([
      ['address_line_1', '9 Elm St'],
      ['state', 'GA'],
      ['zip', '30318'],
    ])
    expect(address?.note).toMatch(/Decatur.*Atlanta, GA/)
  })
})

describe('the name row', () => {
  const opts = ['Glow Salon', 'Hair Studio', 'Atlanta GA']

  it('carries the site’s names as choices', () => {
    const rows = importRows(findings({ nameOptions: opts }), { ...EMPTY, name: 'My Page' }, PAID)
    const row = rows.find((r) => r.key === 'name')
    expect(row?.found).toBe('Glow Salon')
    expect(row?.options).toEqual(opts)
  })

  it('has no choices when the site gives one name', () => {
    const rows = importRows(findings({ nameOptions: ['Glow Salon'] }), { ...EMPTY, name: 'My Page' }, PAID)
    expect(rows.find((r) => r.key === 'name')?.options).toBeUndefined()
  })

  it('is left out when the page already goes by one of them', () => {
    const rows = importRows(findings({ nameOptions: opts }), { ...EMPTY, name: 'hair studio' }, PAID)
    expect(keys(rows)).not.toContain('name')
  })

  it('is offered from the choices when there is no best guess', () => {
    const rows = importRows(findings({ name: null, nameOptions: ['Hair Studio', 'Atlanta GA'] }), { ...EMPTY, name: 'X' }, PAID)
    expect(rows.find((r) => r.key === 'name')?.found).toBe('Hair Studio')
  })

  it('withNameChoice sends the picked or typed name, and nothing when blank', () => {
    const rows = importRows(findings({ nameOptions: opts }), { ...EMPTY, name: 'My Page' }, PAID)
    const picked = withNameChoice(rows, '  Glow   Hair  ')
    expect(pairsFor(picked, new Set(['name']))).toEqual([['name', 'Glow Hair']])
    expect(pairsFor(withNameChoice(rows, '  '), new Set(['name']))).toEqual([])
  })

  it('the sheet lets the owner pick the name', () => {
    const sheet = read('components/listings/finish/SiteImport.tsx')
    expect(sheet).toMatch(/r\.key === 'name' && r\.options \? \(\s*<NamePicker/)
    expect(sheet).toContain('withNameChoice(phase.rows, nameChoice)')
    expect(sheet).toContain('Something else')
  })
})

describe('pairsFor and cardsFor', () => {
  it('send only the ticked rows, and name their cards once', () => {
    const rows = importRows(findings({ name: 'Glow Hair Studio' }), EMPTY, PAID)
    const ticked = new Set(['name', 'phone', 'email'])
    expect(pairsFor(rows, ticked)).toEqual([
      ['name', 'Glow Hair Studio'],
      ['phone', '(404) 555-0100'],
      ['email', 'hi@glowsalon.com'],
    ])
    expect(cardsFor(rows, ticked)).toEqual(['basics', 'contact'])
    expect(pairsFor(rows, new Set())).toEqual([])
  })

  it('hours go as the JSON the hours card saves', () => {
    const rows = importRows(findings(), EMPTY, PAID)
    const [[field, value]] = pairsFor(rows, new Set(['hours'])) as [[string, string]]
    expect(field).toBe('hours')
    expect(JSON.parse(value)).toEqual(WEEK)
  })
})

describe('fitText', () => {
  it('cuts at the limit when no sentence fits', () => {
    expect(fitText('abcdefghij', 4)).toBe('abcd')
    expect(fitText('  short  ', null)).toBe('short')
  })
})

describe('photos', () => {
  it('puts the suggested cover first, then photos, then logos, once each', () => {
    const p = (url: string, kind: 'logo' | 'photo') => ({ url, kind, width: null, alt: null })
    const choices = photoChoices(
      findings({
        photos: [p('a', 'logo'), p('b', 'photo'), p('c', 'photo'), p('b', 'photo')],
        suggestedCover: 'c',
      })
    )
    expect(choices.map((c) => c.url)).toEqual(['c', 'b', 'a'])
  })

  it('photoRoom is the plan room, or every candidate with no cap', () => {
    expect(photoRoom(1, 0, 24)).toBe(1)
    expect(photoRoom(1, 1, 24)).toBe(0)
    expect(photoRoom(10, 2, 24)).toBe(8)
    expect(photoRoom(10, 7, 24)).toBe(3)
    expect(photoRoom(10, 12, 24)).toBe(0)
    expect(photoRoom(null, 40, 24)).toBe(24)
  })

  it('chunk sends picks in runs of one import', () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7, 8], 6)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8]])
    expect(chunk([], 6)).toEqual([])
    expect(chunk([1, 2], 0)).toEqual([[1], [2]])
  })
})

describe('owner actions', () => {
  const src = read('lib/actions/dashboard/siteImport.ts')

  it('check the owner, not the step 0 flag', () => {
    expect(src).toContain("'use server'")
    expect(src).toContain('getOwnerSession')
    expect(src).toMatch(/\.eq\('owner_user_id', owner\.user\.id\)/)
    expect(src).not.toContain('isFeatureEnabled')
  })

  it('bring photos in as gallery photos, and set a cover only on a page with none', () => {
    expect(src).toMatch(/role: 'gallery'/)
    expect(src).toMatch(/\.is\('cover_image_path', null\)/)
  })

  it('step 0 stays behind the flag', () => {
    const step0 = read('lib/actions/listings/siteImport.ts')
    expect(step0.match(/isFeatureEnabled\('siteImport'\)/g)?.length).toBe(2)
  })

  it('the sheet saves text through the cards’ own save action', () => {
    const sheet = read('components/listings/finish/SiteImport.tsx')
    expect(sheet).toContain('updateListingContentAction')
    expect(sheet).toContain('pairsFor(rows, ticked)')
    expect(sheet).toContain('importMySitePhotosAction')
    // Many photos go in batches of one import each.
    expect(sheet).toMatch(/chunk\(photos, MAX_PHOTOS_PER_IMPORT\)/)
  })

  it('the sheet drafts About from the site through writing help, only when it is ready', () => {
    const sheet = read('components/listings/finish/SiteImport.tsx')
    // Through the page's writing help, so the allowance strip stays in step.
    expect(sheet).toContain('useWritingHelp()')
    expect(sheet).toMatch(/help\.request\('listing_description', \{ site_text: siteText \}\)/)
    expect(sheet).toContain('rejectSuggestionAction')
    expect(sheet).toMatch(/fd\.append\('ai_suggestion_id', draft\.id\)/)
    const help = read('components/listings/finish/WritingHelp.tsx')
    expect(help).toMatch(/for \(const \[k, v\] of Object\.entries\(extra \?\? \{\}\)\) form\.set\(k, v\)/)
    // useWritingHelp is null unless help is ready.
    expect(help).toMatch(/help && help\.allowance\.state === 'ready' \? help : null/)
  })

  it('is on the edit page only', () => {
    const view = read('components/listings/PageFinishView.tsx')
    expect(view).toMatch(/mode === 'edit' && \(\s*<SiteImport/)
  })
})

describe('previewContact', () => {
  it('shows what the page has now, in words', () => {
    const c = previewContact(
      {
        ...EMPTY,
        phone: '(404) 555-0100',
        websiteUrl: 'https://www.glowsalon.com/about',
        addressLine1: '12 Peach St',
        hours: WEEK,
        socials: { ...EMPTY.socials, instagram: 'https://instagram.com/glow' },
      },
      true
    )
    expect(c.phone).toBe('(404) 555-0100')
    expect(c.website).toBe('glowsalon.com')
    expect(c.address).toBe('12 Peach St, Atlanta, GA')
    expect(c.hoursLine).toBeTruthy()
    expect(c.socials).toEqual(['Instagram'])
  })

  it('leaves out what is empty, and hours on a page without them', () => {
    const c = previewContact({ ...EMPTY, hours: WEEK }, false)
    expect(c).toEqual({ phone: null, website: null, address: null, hoursLine: null, socials: [] })
  })

  it('the edit page passes photos and contact to the side preview', () => {
    const view = read('components/listings/PageFinishView.tsx')
    expect(view).toMatch(/<LivePagePreview \{\.\.\.preview\} \{\.\.\.previewExtras\} \/>/)
    expect(view).toMatch(/previewContact\(importNow/)
  })
})
