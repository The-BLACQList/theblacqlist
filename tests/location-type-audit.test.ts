import { describe, expect, it } from 'vitest'
import {
  AUDIT_REASONS,
  classify,
  describeConnectionTarget,
  diff,
  isValidLocationType,
  summarize,
  type AuditListing,
} from '@/lib/listings/locationTypeAudit'

/**
 * A storefront that is correctly labelled: address present, `physical`. Every
 * test below states only what it changes, so a future field added to
 * AuditListing breaks compilation here once rather than in every test.
 */
function listing(overrides: Partial<AuditListing> = {}): AuditListing {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Test Business',
    locationType: 'physical',
    addressLine1: '123 Main St',
    serviceAreaDescription: null,
    shipsNationwide: false,
    hasDetailsRow: true,
    ...overrides,
  }
}

describe('isValidLocationType', () => {
  it('accepts all six values the CHECK constraint allows', () => {
    for (const value of ['physical', 'virtual', 'hybrid', 'service_area', 'national', 'traveling']) {
      expect(isValidLocationType(value)).toBe(true)
    }
  })

  it('rejects null, empty, and anything outside the six', () => {
    expect(isValidLocationType(null)).toBe(false)
    expect(isValidLocationType('')).toBe(false)
    expect(isValidLocationType('online')).toBe(false)
    expect(isValidLocationType('Physical')).toBe(false)
  })
})

describe('classify — the label already matches the evidence', () => {
  it('leaves an addressed storefront alone', () => {
    expect(classify(listing())).toEqual({
      current: 'physical',
      proposed: 'physical',
      reason: 'label-consistent',
    })
  })

  it.each(['virtual', 'national', 'service_area', 'traveling'])(
    'accepts %s with no address — those types legitimately have none',
    (type) => {
      const result = classify(listing({ locationType: type, addressLine1: null }))
      expect(result.reason).toBe('label-consistent')
      expect(result.proposed).toBe(type)
    }
  )

  it('accepts a traveling business that also has an address', () => {
    expect(classify(listing({ locationType: 'traveling' })).reason).toBe('label-consistent')
  })

  it('does not flag an addressed national listing — a shop can ship nationwide too', () => {
    const result = classify(listing({ locationType: 'national', shipsNationwide: true }))
    expect(result.reason).toBe('label-consistent')
  })
})

describe('classify — the defect class: physical with no address', () => {
  it('proposes national when the owner ticked ships nationwide', () => {
    expect(classify(listing({ addressLine1: null, shipsNationwide: true }))).toEqual({
      current: 'physical',
      proposed: 'national',
      reason: 'no-address-ships-nationwide',
    })
  })

  it('proposes service_area when the owner described one', () => {
    expect(
      classify(listing({ addressLine1: null, serviceAreaDescription: 'Metro Atlanta, 30 mile radius' }))
    ).toEqual({
      current: 'physical',
      proposed: 'service_area',
      reason: 'no-address-service-area-described',
    })
  })

  it('refuses to choose when both signals are set', () => {
    const result = classify(
      listing({ addressLine1: null, shipsNationwide: true, serviceAreaDescription: 'Metro Atlanta' })
    )
    expect(result.reason).toBe('no-address-conflicting-signals')
    expect(result.proposed).toBe('')
  })

  it('proposes nothing when there is no signal at all — this is the bulk of the 65', () => {
    const result = classify(listing({ addressLine1: null }))
    expect(result).toEqual({ current: 'physical', proposed: '', reason: 'no-address-no-signal' })
    expect(AUDIT_REASONS[result.reason].verdict).toBe('review')
  })

  it('reports a missing details row distinctly from an empty address', () => {
    const result = classify(listing({ addressLine1: null, hasDetailsRow: false }))
    expect(result.reason).toBe('no-details-row')
    expect(result.proposed).toBe('')
  })

  it('treats a whitespace-only address as no address', () => {
    expect(classify(listing({ addressLine1: '   ' })).reason).toBe('no-address-no-signal')
  })

  it('ignores a details-row address when there is no details row', () => {
    // Defensive: a caller that fills addressLine1 but reports hasDetailsRow
    // false is inconsistent; the flag wins, because the flag is the join result.
    expect(classify(listing({ hasDetailsRow: false })).reason).toBe('no-details-row')
  })
})

describe('classify — the other contradictions', () => {
  it('flags hybrid with no address — "storefront + online" needs a storefront', () => {
    const result = classify(listing({ locationType: 'hybrid', addressLine1: null }))
    expect(result.reason).toBe('hybrid-without-address')
    expect(result.proposed).toBe('')
  })

  it('does not flag hybrid when the address is there', () => {
    expect(classify(listing({ locationType: 'hybrid' })).reason).toBe('label-consistent')
  })

  it('flags virtual with a street address', () => {
    const result = classify(listing({ locationType: 'virtual' }))
    expect(result.reason).toBe('addressed-but-online-only')
    expect(result.proposed).toBe('')
  })
})

describe('classify — values outside the enum', () => {
  it('flags null and proposes nothing', () => {
    expect(classify(listing({ locationType: null }))).toEqual({
      current: null,
      proposed: '',
      reason: 'invalid-location-type',
    })
  })

  it('flags an unknown string, whatever the address evidence says', () => {
    expect(classify(listing({ locationType: 'online', addressLine1: null }))).toEqual({
      current: 'online',
      proposed: '',
      reason: 'invalid-location-type',
    })
  })

  it('flags the empty string', () => {
    expect(classify(listing({ locationType: '' })).reason).toBe('invalid-location-type')
  })
})

describe('every reason with a review verdict proposes nothing', () => {
  it('leaves the proposal blank so the CSV forces a human choice', () => {
    const reviewCases: AuditListing[] = [
      listing({ addressLine1: null }),
      listing({ addressLine1: null, hasDetailsRow: false }),
      listing({ addressLine1: null, shipsNationwide: true, serviceAreaDescription: 'x' }),
      listing({ locationType: 'hybrid', addressLine1: null }),
      listing({ locationType: 'virtual' }),
      listing({ locationType: null }),
    ]
    for (const l of reviewCases) {
      const result = classify(l)
      expect(AUDIT_REASONS[result.reason].verdict).toBe('review')
      expect(result.proposed).toBe('')
    }
  })
})

describe('diff', () => {
  it('drops consistent rows and keeps the rest', () => {
    const rows = diff([
      listing({ id: 'a' }),
      listing({ id: 'b', addressLine1: null }),
      listing({ id: 'c', addressLine1: null, shipsNationwide: true }),
    ])
    expect(rows.map((r) => r.id)).toEqual(['b', 'c'])
  })

  it('carries the id, name, and verdict onto each row', () => {
    const [row] = diff([listing({ id: 'x', name: 'Acme', addressLine1: null, shipsNationwide: true })])
    expect(row).toEqual({
      id: 'x',
      name: 'Acme',
      current: 'physical',
      proposed: 'national',
      reason: 'no-address-ships-nationwide',
      verdict: 'change',
    })
  })

  it('returns nothing when every listing is consistent', () => {
    expect(diff([listing({ id: 'a' }), listing({ id: 'b' })])).toEqual([])
  })

  it('returns nothing for an empty input', () => {
    expect(diff([])).toEqual([])
  })
})

describe('summarize', () => {
  it('counts every listing, including the ones diff drops', () => {
    const listings = [
      listing({ id: 'a' }),
      listing({ id: 'b' }),
      listing({ id: 'c', addressLine1: null, shipsNationwide: true }),
      listing({ id: 'd', addressLine1: null }),
      listing({ id: 'e', locationType: null }),
    ]
    expect(summarize(listings)).toEqual({ ok: 2, change: 1, review: 2 })
    expect(summarize(listings).ok + diff(listings).length).toBe(listings.length)
  })

  it('is all zeroes for an empty input', () => {
    expect(summarize([])).toEqual({ ok: 0, change: 0, review: 0 })
  })
})

/**
 * These cases exist because the line they replaced was wrong in production.
 * Both scripts derived the ref as `host.split('.')[0]`, which prints "db" for
 * every direct Supabase connection string — so the operator was told to check
 * for a ref the script could not print. The apply script carried the same line,
 * and that one writes.
 *
 * The password below is a placeholder. A real connection string never appears
 * in this repo.
 */
describe('describeConnectionTarget', () => {
  const REF = 'abcdefghijklmnopqrst'

  it('reads the ref from a direct connection (db.<ref>.supabase.co)', () => {
    expect(describeConnectionTarget(`postgresql://postgres:pw@db.${REF}.supabase.co:5432/postgres`)).toEqual({
      kind: 'remote',
      projectRef: REF,
    })
  })

  it('reads the ref from a bare <ref>.supabase.co host', () => {
    expect(describeConnectionTarget(`postgresql://postgres:pw@${REF}.supabase.co:5432/postgres`)).toEqual({
      kind: 'remote',
      projectRef: REF,
    })
  })

  it('reads the ref from the username on a pooler connection', () => {
    // The pooler host carries the region, not the ref — the ref is in the user.
    const url = `postgresql://postgres.${REF}:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
    expect(describeConnectionTarget(url)).toEqual({ kind: 'remote', projectRef: REF })
  })

  it('reports local for localhost and 127.0.0.1', () => {
    expect(describeConnectionTarget('postgresql://postgres:pw@localhost:54322/postgres').kind).toBe('local')
    expect(describeConnectionTarget('postgresql://postgres:pw@127.0.0.1:54322/postgres').kind).toBe('local')
  })

  it('returns a null ref rather than guessing at an unrecognised host', () => {
    expect(describeConnectionTarget('postgresql://postgres:pw@db.example.com:5432/postgres')).toEqual({
      kind: 'remote',
      projectRef: null,
    })
  })

  it('returns a null ref for a pooler host whose username carries no ref', () => {
    const url = 'postgresql://postgres:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
    expect(describeConnectionTarget(url)).toEqual({ kind: 'remote', projectRef: null })
  })

  it('does not throw on a string that is not a URL', () => {
    expect(describeConnectionTarget('not a url')).toEqual({ kind: 'unknown', projectRef: null })
  })

  it('never returns any part of the credentials', () => {
    const url = `postgresql://postgres:sup3r-s3cret@db.${REF}.supabase.co:5432/postgres`
    expect(JSON.stringify(describeConnectionTarget(url))).not.toContain('s3cret')
  })
})
