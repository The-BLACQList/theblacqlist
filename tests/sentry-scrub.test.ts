import { describe, it, expect } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'
import { scrubPii } from '@/lib/observability/sentry-scrub'

describe('scrubPii (K6 — no PII in Sentry events)', () => {
  it('strips user email / username / ip but keeps a non-identifying id', () => {
    const event = {
      user: {
        id: 'user-123',
        email: 'jane@example.com',
        username: 'jane',
        ip_address: '203.0.113.5',
      },
    } as unknown as ErrorEvent

    const out = scrubPii(event)!
    expect(out.user).toEqual({ id: 'user-123' })
    expect(JSON.stringify(out)).not.toContain('jane@example.com')
    expect(JSON.stringify(out)).not.toContain('203.0.113.5')
  })

  it('drops request body, cookies, and auth headers', () => {
    const event = {
      request: {
        data: { email: 'jane@example.com', password: 'secret' },
        cookies: { 'sb-access-token': 'abc' },
        headers: { cookie: 'sb=abc', authorization: 'Bearer abc', 'user-agent': 'x' },
      },
    } as unknown as ErrorEvent

    const out = scrubPii(event)!
    expect(out.request?.data).toBeUndefined()
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.headers?.['cookie']).toBeUndefined()
    expect(out.request?.headers?.['authorization']).toBeUndefined()
    expect(out.request?.headers?.['user-agent']).toBe('x')
  })

  it('redacts email + phone substrings from message and exception value', () => {
    const event = {
      message: 'Auth failed for jane@example.com calling +1 (415) 555-2671',
      exception: { values: [{ type: 'Error', value: 'login error: bob@test.io' }] },
    } as unknown as ErrorEvent

    const out = scrubPii(event)!
    expect(out.message).not.toContain('jane@example.com')
    expect(out.message).toContain('[redacted-email]')
    expect(out.message).toContain('[redacted-phone]')
    expect(out.exception?.values?.[0]?.value).toContain('[redacted-email]')
    expect(JSON.stringify(out)).not.toContain('bob@test.io')
  })
})
