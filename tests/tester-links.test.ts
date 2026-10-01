import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'

import {
  TESTER_LINK_MAX_USES,
  TESTER_LINK_TTL_DAYS,
  buildTesterLink,
  generateTesterToken,
  hashTesterToken,
  isWellFormedTesterToken,
  normalizeTesterEmail,
  normalizeTesterLabel,
  originFromHeaders,
  testerLinkStatus,
} from '@/lib/tester/links'

// The pure half of the one-tap tester link (one-tap-link-plan-2026-10-01.md).

describe('tester link tokens', () => {
  it('locks the approved D1 numbers', () => {
    expect(TESTER_LINK_MAX_USES).toBe(5)
    expect(TESTER_LINK_TTL_DAYS).toBe(14)
  })

  it('generates 43-char base64url tokens that pass the shape check', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const token = generateTesterToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(isWellFormedTesterToken(token)).toBe(true)
      seen.add(token)
    }
    expect(seen.size).toBe(50)
  })

  it('hashes to deterministic sha256 hex', () => {
    const token = generateTesterToken()
    expect(hashTesterToken(token)).toBe(hashTesterToken(token))
    expect(hashTesterToken(token)).toBe(createHash('sha256').update(token).digest('hex'))
    expect(hashTesterToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashTesterToken(token)).not.toBe(hashTesterToken(generateTesterToken()))
  })

  it.each(['', 'short', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`, `${'a'.repeat(42)}/`])(
    'rejects malformed token %j',
    (value) => {
      expect(isWellFormedTesterToken(value)).toBe(false)
    }
  )
})

describe('buildTesterLink', () => {
  it('puts the token in the fragment', () => {
    expect(buildTesterLink('https://theblacqlist.com', 'abc')).toBe('https://theblacqlist.com/t#abc')
  })

  it('strips trailing slashes from the origin', () => {
    expect(buildTesterLink('https://x.vercel.app//', 'abc')).toBe('https://x.vercel.app/t#abc')
  })
})

describe('originFromHeaders', () => {
  it('prefers the forwarded host and proto', () => {
    const h = new Headers({ 'x-forwarded-host': 'pr-1.vercel.app', 'x-forwarded-proto': 'https', host: 'internal:3000' })
    expect(originFromHeaders(h)).toBe('https://pr-1.vercel.app')
  })

  it('falls back to host, https by default', () => {
    expect(originFromHeaders(new Headers({ host: 'theblacqlist.com' }))).toBe('https://theblacqlist.com')
  })

  it('uses http for localhost', () => {
    expect(originFromHeaders(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
    expect(originFromHeaders(new Headers({ host: '127.0.0.1:3000' }))).toBe('http://127.0.0.1:3000')
  })

  it('returns null with no host', () => {
    expect(originFromHeaders(new Headers())).toBeNull()
  })
})

describe('normalizers', () => {
  it('trims and lowercases a valid email', () => {
    expect(normalizeTesterEmail('  Tester@Example.COM ')).toBe('tester@example.com')
  })

  it.each(['', 'nope', 'a@b', 'a b@c.d', `${'a'.repeat(250)}@b.co`])('rejects email %j', (raw) => {
    expect(normalizeTesterEmail(raw)).toBeNull()
  })

  it('accepts labels of 1 to 40 chars after trimming', () => {
    expect(normalizeTesterLabel('  T-07 ')).toBe('T-07')
    expect(normalizeTesterLabel('x'.repeat(40))).toBe('x'.repeat(40))
    expect(normalizeTesterLabel('   ')).toBeNull()
    expect(normalizeTesterLabel('x'.repeat(41))).toBeNull()
  })
})

describe('testerLinkStatus', () => {
  const now = new Date('2026-10-05T12:00:00Z')
  const future = '2026-10-15T00:00:00Z'
  const past = '2026-10-01T00:00:00Z'
  const base = { use_count: 0, max_uses: 5, expires_at: future, revoked_at: null }

  it('reads unused, in use and used up', () => {
    expect(testerLinkStatus(base, now)).toEqual({ state: 'unused', label: 'Unused' })
    expect(testerLinkStatus({ ...base, use_count: 2 }, now)).toEqual({ state: 'in_use', label: 'Used 2 of 5' })
    expect(testerLinkStatus({ ...base, use_count: 5 }, now)).toEqual({ state: 'used_up', label: 'Used 5 of 5' })
  })

  it('treats the expiry instant as expired', () => {
    expect(testerLinkStatus({ ...base, expires_at: now.toISOString() }, now).state).toBe('expired')
  })

  it('ranks revoked over expired over used up', () => {
    expect(testerLinkStatus({ ...base, use_count: 5, expires_at: past, revoked_at: past }, now).state).toBe('revoked')
    expect(testerLinkStatus({ ...base, use_count: 5, expires_at: past }, now).state).toBe('expired')
  })
})
