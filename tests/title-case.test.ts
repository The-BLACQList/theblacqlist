import { describe, it, expect } from 'vitest'
import { toTitleCase, isTitleCase } from '@/lib/text/title-case'

// Ticket 205. The house Title Case rule (docs/blacqlist/design/title-case.md).

describe('toTitleCase', () => {
  it.each([
    ['Add a listing', 'Add a Listing'],
    ['Claim a business', 'Claim a Business'],
    ['Claim your business', 'Claim Your Business'],
    ['Saved businesses', 'Saved Businesses'],
    ['where else to find us', 'Where Else to Find Us'],
    ['Read our story', 'Read Our Story'],
    ['See the full menu', 'See the Full Menu'],
    ['On the menu', 'On the Menu'],
    ['Good to know', 'Good to Know'],
    ['Amenities and details', 'Amenities and Details'],
    ['New registrations — last 8 weeks', 'New Registrations — Last 8 Weeks'],
    ['Search: a fresh start', 'Search: A Fresh Start'],
  ])('%s → %s', (input, expected) => {
    expect(toTitleCase(input)).toBe(expected)
  })

  it('capitalizes the particle of a phrasal verb', () => {
    expect(toTitleCase('Sign in')).toBe('Sign In')
    expect(toTitleCase('Log out')).toBe('Log Out')
    expect(toTitleCase('Set up your page')).toBe('Set Up Your Page')
    expect(toTitleCase('Sign up for free')).toBe('Sign Up for Free')
  })

  it('keeps prepositions lowercase after ordinary verbs', () => {
    expect(toTitleCase('Open in maps')).toBe('Open in Maps')
    expect(toTitleCase('Show on map')).toBe('Show on Map')
  })

  it('capitalizes a minor word when it comes last', () => {
    expect(toTitleCase('What we stand for')).toBe('What We Stand For')
    expect(toTitleCase('Sign up')).toBe('Sign Up')
  })

  it('leaves brand and product spellings alone', () => {
    expect(toTitleCase('about The BLACQList')).toBe('About The BLACQList')
    expect(toTitleCase('Read BLACQLight')).toBe('Read BLACQLight')
    expect(toTitleCase('Get the iOS app')).toBe('Get the iOS App')
    expect(toTitleCase('Free wi-fi')).toBe('Free Wi-Fi')
    expect(toTitleCase('Open 24/7')).toBe('Open 24/7')
    expect(toTitleCase('AI tools')).toBe('AI Tools')
  })

  it('capitalizes both halves of a hyphenated word', () => {
    expect(toTitleCase('Black-owned near you')).toBe('Black-Owned Near You')
  })

  it('does not touch handles, links or emails', () => {
    expect(toTitleCase('Follow @theblacqlist')).toBe('Follow @theblacqlist')
    expect(toTitleCase('Email hello@theblacqlist.com')).toBe('Email hello@theblacqlist.com')
  })

  it('keeps surrounding whitespace and punctuation', () => {
    expect(toTitleCase('\n   Saved businesses\n  ')).toBe('\n   Saved Businesses\n  ')
    expect(toTitleCase('“Add a listing”')).toBe('“Add a Listing”')
    expect(toTitleCase('Next step →')).toBe('Next Step →')
    expect(toTitleCase('(optional) phone number')).toBe('(Optional) Phone Number')
  })

  it('keeps contractions in one word', () => {
    expect(toTitleCase("What's on today")).toBe("What's on Today")
    expect(toTitleCase("Don't have an account?")).toBe("Don't Have an Account?")
  })
})

describe('toTitleCase edge cases', () => {
  it('starts a new segment after a separator', () => {
    expect(toTitleCase('Collections | The BLACQList')).toBe('Collections | The BLACQList')
    expect(toTitleCase('Finish your page | The BLACQList')).toBe('Finish Your Page | The BLACQList')
    expect(toTitleCase('Receipts — a guide')).toBe('Receipts — A Guide')
  })

  it('keeps "The" in the brand name', () => {
    expect(toTitleCase('Third-party services used by The BLACQList')).toBe(
      'Third-Party Services Used by The BLACQList'
    )
  })

  it('knows which particles belong to which verb', () => {
    expect(toTitleCase('How you show up on Google')).toBe('How You Show Up on Google')
    expect(toTitleCase('Bring in my info')).toBe('Bring In My Info')
  })

  it('does not force first or last capitals on a label split by a value', () => {
    // "Browse all in {city}"
    expect(toTitleCase('Browse all in', { continuesAfter: true })).toBe('Browse All in')
    // "{name} is under review"
    expect(toTitleCase(' is under review', { continuesBefore: true })).toBe(' Is Under Review')
    expect(toTitleCase(' of the week', { continuesBefore: true })).toBe(' of the Week')
  })

  it('keeps "The" in The Collective', () => {
    expect(toTitleCase('See the Collective')).toBe('See The Collective')
    expect(toTitleCase('A place in The Collective')).toBe('A Place in The Collective')
  })

  it('keeps units lowercase', () => {
    expect(toTitleCase(' mi', { continuesBefore: true })).toBe(' mi')
    expect(toTitleCase('Within 5 mi')).toBe('Within 5 mi')
    // An all-caps word that looks like a unit is an acronym.
    expect(toTitleCase('HR & Staffing')).toBe('HR & Staffing')
  })

  it('keeps a minor word lowercase in the middle of a hyphenated word', () => {
    expect(toTitleCase('Your link-in-bio page')).toBe('Your Link-in-Bio Page')
    expect(toTitleCase('Up-to-date hours')).toBe('Up-to-Date Hours')
    expect(toTitleCase('Your Link-In-Bio Page')).toBe('Your Link-in-Bio Page')
  })

  it('leaves HTML entities intact', () => {
    expect(toTitleCase('Don&apos;t send')).toBe('Don&apos;t Send')
    expect(toTitleCase('Photos &amp; video')).toBe('Photos &amp; Video')
    expect(toTitleCase('&ldquo;add a listing&rdquo;')).toBe('&ldquo;Add a Listing&rdquo;')
  })
})

describe('isTitleCase', () => {
  it('accepts Title Case and rejects sentence case', () => {
    expect(isTitleCase('Add a Listing')).toBe(true)
    expect(isTitleCase('Add a listing')).toBe(false)
  })
})
