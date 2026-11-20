// =============================================================================
// Ticket 234: where a sign-up came from
// =============================================================================
// proxy.ts keeps a signed-out visitor's first outside arrival (campaign tags or
// the referring site) in the bl_ft cookie; signUpAction saves it with the new
// account and on the sign_up_completed event. Pinned here:
//
//   - only the host of a referring site is kept, never the full address;
//   - our own pages are not a referrer;
//   - first touch wins, and signed-in visitors and API calls are left alone;
//   - a tampered cookie can't write anything outside the safe alphabet;
//   - after the coming-soon gate comes down, a plain sign-up is 'public', not
//     'invite'.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FIRST_TOUCH_COOKIE,
  cleanTag,
  decodeFirstTouch,
  encodeFirstTouch,
  firstTouchFrom,
  referrerHost,
} from '@/lib/analytics/first-touch'

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  jar: new Map<string, string>(),
  signUpData: [] as Record<string, unknown>[],
  events: [] as { event_name: string; properties?: Record<string, unknown> }[],
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: h.getUser } })),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: () => {} }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signUp: async (args: { options: { data: Record<string, unknown> } }) => {
        h.signUpData.push(args.options.data)
        return {
          data: { user: { identities: [{ id: 'identity-1' }] }, session: null },
          error: null,
        }
      },
    },
  }),
}))

vi.mock('@/lib/email/resend', () => ({ sendEmail: async () => {} }))
vi.mock('@/lib/email/templates/welcome', () => ({ WelcomeEmail: () => null }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (h.jar.has(name) ? { name, value: h.jar.get(name)! } : undefined),
  }),
}))

vi.mock('@/lib/analytics/server', () => ({
  trackServerEvent: (input: { event_name: string; properties?: Record<string, unknown> }) => {
    h.events.push(input)
  },
}))

import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const { signUpAction } = await import('@/lib/actions/auth/signUp')

beforeEach(() => {
  h.getUser.mockReset()
  h.getUser.mockResolvedValue({ data: { user: null } })
  h.jar.clear()
  h.signUpData = []
  h.events = []
})

afterEach(() => {
  delete process.env.COMING_SOON_MODE
  delete process.env.COMING_SOON_BYPASS_TOKEN
})

// -----------------------------------------------------------------------------

describe('cleaning what arrives', () => {
  it('lowercases a tag and keeps it to a short safe alphabet', () => {
    expect(cleanTag('  Instagram ')).toBe('instagram')
    expect(cleanTag('Fall Launch 2026!')).toBe('fall-launch-2026')
    expect(cleanTag('<script>alert(1)</script>')).toBe('script-alert-1-script')
    expect(cleanTag('a'.repeat(200))).toHaveLength(64)
    expect(cleanTag('   ')).toBeUndefined()
    expect(cleanTag('!!!')).toBeUndefined()
  })

  it('keeps only the host of a referring site', () => {
    expect(
      referrerHost(
        'https://l.instagram.com/?u=https%3A%2F%2Ftheblacqlist.com&e=abc',
        'theblacqlist.com'
      )
    ).toBe('l.instagram.com')
    expect(
      referrerHost('https://www.google.com/search?q=black+owned+coffee', 'theblacqlist.com')
    ).toBe('google.com')
  })

  it('does not count our own pages, a preview host, or junk as a referrer', () => {
    expect(referrerHost('https://theblacqlist.com/discover', 'theblacqlist.com')).toBeUndefined()
    expect(referrerHost('https://www.theblacqlist.com/', 'theblacqlist.com')).toBeUndefined()
    expect(
      referrerHost('https://staging.theblacqlist.com/', 'staging.theblacqlist.com')
    ).toBeUndefined()
    expect(referrerHost('https://bl-git-x.vercel.app/a', 'bl-git-x.vercel.app')).toBeUndefined()
    expect(referrerHost('android-app://com.slack/', 'theblacqlist.com')).toBeUndefined()
    expect(referrerHost('not a url', 'theblacqlist.com')).toBeUndefined()
    expect(referrerHost('', 'theblacqlist.com')).toBeUndefined()
  })

  it('says nothing about a visit with no tags and no outside referrer', () => {
    expect(firstTouchFrom(new URLSearchParams('q=coffee'), null, 'theblacqlist.com')).toBeNull()
  })

  it('round-trips through the cookie value', () => {
    const t = {
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'fall-launch',
      referrer: 'l.instagram.com',
    }
    expect(decodeFirstTouch(encodeFirstTouch(t))).toEqual(t)
    expect(decodeFirstTouch(encodeFirstTouch({ referrer: 'google.com' }))).toEqual({
      referrer: 'google.com',
    })
  })

  it('reads a tampered or unknown cookie as nothing, or cleans it', () => {
    expect(decodeFirstTouch('v2|a|b|c|d.com')).toBeNull()
    expect(decodeFirstTouch('garbage')).toBeNull()
    expect(decodeFirstTouch('v1||||')).toBeNull()
    expect(decodeFirstTouch('v1|Evil Value"; x|||not a host')).toEqual({
      utm_source: 'evil-value-x',
    })
  })
})

// -----------------------------------------------------------------------------

function visit(path: string, opts: { referer?: string; cookie?: string; method?: string } = {}) {
  const headers = new Headers()
  if (opts.referer) headers.set('referer', opts.referer)
  const req = new NextRequest(new URL(`https://theblacqlist.com${path}`), {
    headers,
    method: opts.method ?? 'GET',
  })
  if (opts.cookie) req.cookies.set(FIRST_TOUCH_COOKIE, opts.cookie)
  return req
}

describe('the proxy keeps the first outside arrival', () => {
  it('stamps campaign tags from the link', async () => {
    const res = await proxy(
      visit('/discover?utm_source=Instagram&utm_medium=social&utm_campaign=Fall%20Launch')
    )
    const c = res.cookies.get(FIRST_TOUCH_COOKIE)
    expect(decodeFirstTouch(c?.value)).toEqual({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'fall-launch',
    })
    expect(c).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('stamps the referring site with no tags', async () => {
    const res = await proxy(visit('/', { referer: 'https://www.facebook.com/somebody/posts/1' }))
    expect(decodeFirstTouch(res.cookies.get(FIRST_TOUCH_COOKIE)?.value)).toEqual({
      referrer: 'facebook.com',
    })
  })

  it('stamps it on the coming-soon bounce, which drops the query string', async () => {
    process.env.COMING_SOON_MODE = 'true'
    process.env.COMING_SOON_BYPASS_TOKEN = 'fake-token'
    const res = await proxy(visit('/pricing?utm_source=flyer2'))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/coming-soon')
    expect(decodeFirstTouch(res.cookies.get(FIRST_TOUCH_COOKIE)?.value)).toEqual({
      utm_source: 'flyer2',
    })
  })

  it('leaves an earlier arrival in place: first touch wins', async () => {
    const first = encodeFirstTouch({ utm_source: 'instagram' })
    const res = await proxy(visit('/?utm_source=tiktok', { cookie: first }))
    expect(res.cookies.get(FIRST_TOUCH_COOKIE)).toBeUndefined()
  })

  it('sets nothing for a visit from our own pages, with no tags', async () => {
    const res = await proxy(visit('/discover', { referer: 'https://theblacqlist.com/' }))
    expect(res.cookies.get(FIRST_TOUCH_COOKIE)).toBeUndefined()
  })

  it('sets nothing for a signed-in visitor, an API call or a form post', async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    expect((await proxy(visit('/?utm_source=x'))).cookies.get(FIRST_TOUCH_COOKIE)).toBeUndefined()
    h.getUser.mockResolvedValue({ data: { user: null } })
    expect(
      (await proxy(visit('/api/search?utm_source=x'))).cookies.get(FIRST_TOUCH_COOKIE)
    ).toBeUndefined()
    expect(
      (await proxy(visit('/sign-up?utm_source=x', { method: 'POST' }))).cookies.get(
        FIRST_TOUCH_COOKIE
      )
    ).toBeUndefined()
  })
})

// -----------------------------------------------------------------------------

function form(): FormData {
  const fd = new FormData()
  fd.set('displayName', 'Test Person')
  fd.set('email', 'someone@example.test')
  fd.set('password', 'Correct-Horse-Battery1')
  return fd
}

describe('sign-up saves where the account came from', () => {
  it('saves the tags and referrer with the account and on the event', async () => {
    h.jar.set(
      FIRST_TOUCH_COOKIE,
      encodeFirstTouch({
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'fall-launch',
        referrer: 'l.instagram.com',
      })
    )
    await signUpAction(null, form())

    expect(h.signUpData[0]!).toMatchObject({
      signup_source: 'public',
      signup_utm_source: 'instagram',
      signup_utm_medium: 'social',
      signup_utm_campaign: 'fall-launch',
      signup_referrer: 'l.instagram.com',
    })
    expect(h.events).toEqual([
      {
        event_name: 'sign_up_completed',
        properties: {
          source: 'public',
          role: 'supporter',
          utm_source: 'instagram',
          utm_medium: 'social',
          utm_campaign: 'fall-launch',
          referrer: 'l.instagram.com',
        },
      },
    ])
  })

  it('adds nothing when there is no cookie', async () => {
    await signUpAction(null, form())
    expect(Object.keys(h.signUpData[0]!).filter((k) => k.startsWith('signup_'))).toEqual([
      'signup_source',
    ])
    expect(h.events[0]!.properties).toEqual({ source: 'public', role: 'supporter' })
  })

  it('keeps flyer and invite while the gate is up', async () => {
    process.env.COMING_SOON_MODE = 'true'
    await signUpAction(null, form())
    h.jar.set('bl_src', 'flyer')
    await signUpAction(null, form())
    expect(h.signUpData.map((d) => d.signup_source)).toEqual(['invite', 'flyer'])
  })

  it('ignores a made-up bl_src value', async () => {
    h.jar.set('bl_src', 'anything-at-all')
    await signUpAction(null, form())
    expect(h.signUpData[0]!.signup_source).toBe('public')
  })
})
