import { describe, expect, it } from 'vitest'
import type { SiteFindings } from '@/lib/import/read-site'
import { aboutMax, EMPTY_ANSWERS, type QuickStartAnswers } from '@/lib/listings/quickStart'
import {
  applyFindings,
  businessDomainFromEmail,
  findConflicts,
  siteFormFields,
  type ConflictChoices,
} from '@/lib/import/siteDraft'

const HOURS = {
  monday: { open: '09:00', close: '17:00', closed: false },
  tuesday: { open: '09:00', close: '17:00', closed: false },
  wednesday: { open: '09:00', close: '17:00', closed: false },
  thursday: { open: '09:00', close: '17:00', closed: false },
  friday: { open: '09:00', close: '19:00', closed: false },
  saturday: { open: '10:00', close: '16:00', closed: false },
  sunday: { open: '', close: '', closed: true },
}

function findings(over: Partial<SiteFindings> = {}): SiteFindings {
  return {
    sourceHost: 'glowsalon.com',
    isLinkInBio: false,
    name: 'Glow Salon',
    about: 'A family salon on the South Side since 2009.',
    phones: ['(312) 555-0100'],
    emails: ['hello@glowsalon.com'],
    address: { street: '123 King Dr', city: 'Chicago', state: 'IL', zip: '60615' },
    hours: HOURS,
    socials: { instagram: 'https://instagram.com/glowsalon' },
    website: 'https://glowsalon.com/',
    photos: [],
    suggestedLogo: null,
    suggestedCover: null,
    ...over,
  }
}

const answers = (over: Partial<QuickStartAnswers> = {}): QuickStartAnswers => ({ ...EMPTY_ANSWERS, ...over })
const CHOICES: ConflictChoices = { name: 'typed', phone: null, email: 'signIn' }
const CITIES = [
  { id: 'chi', name: 'Chicago', stateCode: 'IL' },
  { id: 'atl', name: 'Atlanta', stateCode: 'GA' },
]

describe('businessDomainFromEmail', () => {
  it('fills in a business domain', () => {
    expect(businessDomainFromEmail('maya@GlowSalon.com')).toBe('glowsalon.com')
  })

  it('skips personal mail and school addresses', () => {
    for (const email of ['maya@gmail.com', 'maya@icloud.com', 'maya@comcast.net', 'maya@uchicago.edu']) {
      expect(businessDomainFromEmail(email)).toBe('')
    }
  })

  it('gives nothing for a malformed address', () => {
    for (const email of ['', 'maya', '@glowsalon.com', 'maya@localhost']) {
      expect(businessDomainFromEmail(email)).toBe('')
    }
  })
})

describe('findConflicts', () => {
  it('finds nothing when the draft is empty and the site has one of each', () => {
    expect(findConflicts(findings(), answers(), 'hello@glowsalon.com')).toEqual({
      name: null,
      phones: [],
      email: null,
    })
  })

  it('asks when the owner typed a different name', () => {
    const c = findConflicts(findings(), answers({ name: 'Glow Hair Studio' }), '')
    expect(c.name).toEqual({ typed: 'Glow Hair Studio', site: 'Glow Salon' })
  })

  it('does not ask when the names match apart from case', () => {
    expect(findConflicts(findings(), answers({ name: 'glow salon ' }), '').name).toBeNull()
  })

  it('asks which phone when the site has two', () => {
    const c = findConflicts(findings({ phones: ['(312) 555-0100', '(312) 555-0199'] }), answers(), '')
    expect(c.phones).toHaveLength(2)
  })

  it('asks which email when the site email differs from the sign-in', () => {
    const c = findConflicts(findings(), answers(), 'maya@gmail.com')
    expect(c.email).toEqual({ signIn: 'maya@gmail.com', site: 'hello@glowsalon.com' })
  })
})

describe('applyFindings', () => {
  it('fills empty answers and records which steps came from the site', () => {
    const { patch, site } = applyFindings({
      findings: findings(),
      answers: answers(),
      choices: CHOICES,
      cities: CITIES,
      tempId: 'tmp',
    })
    expect(patch).toEqual({
      name: 'Glow Salon',
      about: 'A family salon on the South Side since 2009.',
      cityId: 'chi',
    })
    expect(site.fromSite).toEqual(['name', 'about', 'where'])
    expect(site.phone).toBe('(312) 555-0100')
    expect(site.email).toBeNull()
    expect(site.website).toBe('https://glowsalon.com/')
  })

  it('never overwrites what the owner typed unless they chose the site', () => {
    const typed = answers({ name: 'Glow Hair Studio', about: 'My own words about us.', cityId: 'atl' })
    const kept = applyFindings({ findings: findings(), answers: typed, choices: CHOICES, cities: CITIES, tempId: 't' })
    expect(kept.patch).toEqual({})
    expect(kept.site.fromSite).toEqual([])

    const chose = applyFindings({
      findings: findings(),
      answers: typed,
      choices: { ...CHOICES, name: 'site' },
      cities: CITIES,
      tempId: 't',
    })
    expect(chose.patch).toEqual({ name: 'Glow Salon' })
  })

  it('types the city when it is not one of ours', () => {
    const { patch } = applyFindings({
      findings: findings({ address: { street: null, city: 'Gary', state: 'IN', zip: null } }),
      answers: answers(),
      choices: CHOICES,
      cities: CITIES,
      tempId: 't',
    })
    expect(patch.cityId).toBeUndefined()
    expect(patch.cityText).toBe('Gary')
    expect(patch.stateText).toBe('IN')
  })

  it('does not match a city of the same name in another state', () => {
    const { patch } = applyFindings({
      findings: findings({ address: { street: null, city: 'Atlanta', state: 'TX', zip: null } }),
      answers: answers(),
      choices: CHOICES,
      cities: CITIES,
      tempId: 't',
    })
    expect(patch.cityText).toBe('Atlanta')
  })

  it('cuts a long about at a sentence that fits', () => {
    const sentence = 'We braid, loc, and color natural hair for the whole family. '
    const long = sentence.repeat(Math.ceil((aboutMax() * 2) / sentence.length))
    const { patch } = applyFindings({
      findings: findings({ about: long }),
      answers: answers(),
      choices: CHOICES,
      cities: CITIES,
      tempId: 't',
    })
    expect(patch.about!.length).toBeLessThanOrEqual(aboutMax())
    expect(patch.about!.endsWith('.')).toBe(true)
  })

  it('uses the phone and email the owner picked', () => {
    const { site } = applyFindings({
      findings: findings({ phones: ['(312) 555-0100', '(312) 555-0199'] }),
      answers: answers(),
      choices: { name: 'typed', phone: '(312) 555-0199', email: 'site' },
      cities: CITIES,
      tempId: 't',
    })
    expect(site.phone).toBe('(312) 555-0199')
    expect(site.email).toBe('hello@glowsalon.com')
  })

  it('drops a website that is not https', () => {
    const { site } = applyFindings({
      findings: findings({ website: 'http://glowsalon.com/' }),
      answers: answers(),
      choices: CHOICES,
      cities: CITIES,
      tempId: 't',
    })
    expect(site.website).toBeNull()
  })
})

describe('siteFormFields', () => {
  const base = () =>
    applyFindings({ findings: findings(), answers: answers(), choices: CHOICES, cities: CITIES, tempId: 'abc' }).site

  it('adds everything createListing reads from the site', () => {
    const site = { ...base(), logoPath: 'listings/abc/logo/1.webp', coverPath: 'listings/abc/cover/2.webp' }
    const fields = Object.fromEntries(siteFormFields(site))
    expect(fields).toEqual({
      imported_from: 'glowsalon.com',
      temp_entity_id: 'abc',
      website_url: 'https://glowsalon.com/',
      address_line_1: '123 King Dr',
      zip: '60615',
      hours: JSON.stringify(HOURS),
      social_instagram: 'https://instagram.com/glowsalon',
      logo_path: 'listings/abc/logo/1.webp',
      cover_image_path: 'listings/abc/cover/2.webp',
    })
  })

  it('leaves out a zip without a street, and empty pieces', () => {
    const site = { ...base(), address: { street: null, city: 'Chicago', state: 'IL', zip: '60615' }, hours: null, socials: {}, website: null }
    expect(Object.fromEntries(siteFormFields(site))).toEqual({ imported_from: 'glowsalon.com', temp_entity_id: 'abc' })
  })
})
