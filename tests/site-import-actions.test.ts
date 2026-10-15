import { beforeEach, describe, expect, it, vi } from 'vitest'

// Ticket 127: the step 0 actions. The fetcher, the reader and the image path
// have their own suites; this pins the gates around them (flag, sign-in, rate
// limits, robots.txt, rights) and how each failure reads to an owner.

const LISTING_ID = '33333333-3333-4333-8333-333333333333'

const h = vi.hoisted(() => ({
  flag: true,
  user: { id: 'user-1' } as { id: string } | null,
  rateOk: true,
  rateCalls: [] as Array<{ bucket: string; identifier: string }>,
  // URL → response or error. Anything missing is a 404.
  responses: {} as Record<string, { body: string; contentType?: string; url?: string } | Error>,
  fetched: [] as string[],
  imports: [] as Array<{ url: string; role: string; listingId: string }>,
  importResult: (() => ({ ok: true, path: 'listings/x/gallery/a.jpg', mediaId: 'm1' })) as (
    url: string
  ) => Record<string, unknown>,
}))

vi.mock('@/lib/env', async (orig) => {
  const real = await orig<typeof import('@/lib/env')>()
  return { ...real, isFeatureEnabled: (flag: string) => (flag === 'siteImport' ? h.flag : false) }
})
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))
vi.mock('@/lib/security/rate-limit', async (orig) => {
  const real = await orig<typeof import('@/lib/security/rate-limit')>()
  return {
    ...real,
    checkRateLimit: async (args: { bucket: string; identifier: string }) => {
      h.rateCalls.push({ bucket: args.bucket, identifier: args.identifier })
      return h.rateOk
    },
  }
})
vi.mock('@/lib/import/safe-fetch', async (orig) => {
  const real = await orig<typeof import('@/lib/import/safe-fetch')>()
  return {
    ...real,
    safeFetch: async (url: string) => {
      h.fetched.push(url)
      const res = h.responses[url]
      if (res instanceof Error) throw res
      if (!res) throw new real.SafeFetchError('not_found', 'missing')
      return {
        url: res.url ?? url,
        status: 200,
        contentType: res.contentType ?? 'text/html',
        body: Buffer.from(res.body),
      }
    },
  }
})
vi.mock('@/lib/media/importRemoteImage', () => ({
  importRemoteImage: async (args: { url: string; role: string; listingId: string }) => {
    h.imports.push({ url: args.url, role: args.role, listingId: args.listingId })
    return h.importResult(args.url)
  },
}))

const { readSiteAction, importSitePhotosAction } = await import('@/lib/actions/listings/siteImport')
type PhotoPick = import('@/lib/actions/listings/siteImport').PhotoPick
const { SafeFetchError } = await import('@/lib/import/safe-fetch')

const SALON_HTML = `<!doctype html><html><head><title>Glow Salon</title>
<meta name="description" content="Natural hair care and braids in the West End since 2015.">
</head><body><a href="tel:+14045550123">Call us</a>
<a href="https://instagram.com/glowsalonatl">Instagram</a></body></html>`

beforeEach(() => {
  h.flag = true
  h.user = { id: 'user-1' }
  h.rateOk = true
  h.rateCalls = []
  h.responses = { 'https://glowsalon.com/': { body: SALON_HTML } }
  h.fetched = []
  h.imports = []
  h.importResult = () => ({ ok: true, path: 'listings/x/gallery/a.jpg', mediaId: 'm1' })
})

describe('readSiteAction', () => {
  it('reads a bare domain as an https page and returns what it found', async () => {
    const res = await readSiteAction('glowsalon.com')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.findings.sourceHost).toBe('glowsalon.com')
    expect(res.findings.phones.length).toBeGreaterThan(0)
    expect(res.findings.socials.instagram).toContain('glowsalonatl')
    expect(h.fetched).toEqual(['https://glowsalon.com/robots.txt', 'https://glowsalon.com/'])
  })

  it('does nothing while the flag is off', async () => {
    h.flag = false
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('not open yet') })
    expect(h.fetched).toEqual([])
  })

  it('needs a signed-in owner', async () => {
    h.user = null
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false })
    expect(h.fetched).toEqual([])
  })

  it('charges the owner and the IP address', async () => {
    await readSiteAction('glowsalon.com')
    expect(h.rateCalls).toEqual([
      { bucket: 'site_import', identifier: 'read:user-1' },
      { bucket: 'site_import', identifier: 'read-ip:203.0.113.9' },
    ])
  })

  it('stops at the rate limit before any fetch', async () => {
    h.rateOk = false
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('Wait a bit') })
    expect(h.fetched).toEqual([])
  })

  it('refuses private addresses before any fetch', async () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest',
      'ftp://glowsalon.com',
      'glow salon.com',
      'localhost:3000',
      'http://[::1]/',
    ]) {
      expect(await readSiteAction(url)).toMatchObject({ ok: false, error: expect.stringContaining('Check the web address') })
    }
    expect(h.fetched).toEqual([])
  })

  it('honors a robots.txt that keeps us out', async () => {
    h.responses['https://glowsalon.com/robots.txt'] = { body: 'User-agent: *\nDisallow: /', contentType: 'text/plain' }
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('asks tools like ours') })
    expect(h.fetched).toEqual(['https://glowsalon.com/robots.txt'])
  })

  it('checks robots.txt again when the page redirects to another host', async () => {
    h.responses['https://glowsalon.com/'] = { body: SALON_HTML, url: 'https://glowsalon.square.site/' }
    h.responses['https://glowsalon.square.site/robots.txt'] = { body: 'User-agent: theblacqlist\nDisallow: /', contentType: 'text/plain' }
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('asks tools like ours') })
  })

  it('reads the page when robots.txt cannot be found', async () => {
    h.responses['https://glowsalon.com/robots.txt'] = new SafeFetchError('http_error', '403')
    expect((await readSiteAction('glowsalon.com')).ok).toBe(true)
  })

  it('says a slow site is slow', async () => {
    h.responses['https://glowsalon.com/'] = new SafeFetchError('timeout', 'slow')
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('too long') })
  })

  it('says when a site cannot be found', async () => {
    delete h.responses['https://glowsalon.com/']
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('could not find that site') })
  })

  it('refuses something that is not a web page', async () => {
    h.responses['https://glowsalon.com/'] = { body: '%PDF-1.7', contentType: 'application/pdf' }
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('not a web page') })
  })

  it('says so when the page has nothing beyond a title', async () => {
    h.responses['https://glowsalon.com/'] = { body: '<html><head><title>Coming soon</title></head><body></body></html>' }
    expect(await readSiteAction('glowsalon.com')).toMatchObject({ ok: false, error: expect.stringContaining('anything useful') })
  })

  it('never says "scrape" to an owner', async () => {
    const cases: Array<() => void> = [
      () => (h.flag = false),
      () => (h.rateOk = false),
      () => (h.responses['https://glowsalon.com/'] = new SafeFetchError('network', 'x')),
    ]
    for (const setup of cases) {
      setup()
      const res = await readSiteAction('glowsalon.com')
      expect(!res.ok && res.error).not.toMatch(/scrap/i)
      expect(!res.ok && res.error).not.toContain('—')
    }
  })
})

describe('importSitePhotosAction', () => {
  const picks: PhotoPick[] = [
    { url: 'https://glowsalon.com/logo.png', role: 'logo' },
    { url: 'https://glowsalon.com/chair.jpg', role: 'gallery' },
  ]

  it('brings in each picked photo against the page id', async () => {
    h.importResult = (url) => ({ ok: true, path: `listings/${LISTING_ID}/${url.endsWith('png') ? 'logo' : 'gallery'}/x`, mediaId: null })
    const res = await importSitePhotosAction({ listingId: LISTING_ID, picks, rightsConfirmed: true })
    expect(res).toEqual({
      ok: true,
      photos: [
        { ...picks[0], ok: true, path: `listings/${LISTING_ID}/logo/x` },
        { ...picks[1], ok: true, path: `listings/${LISTING_ID}/gallery/x` },
      ],
    })
    expect(h.imports.map((i) => i.listingId)).toEqual([LISTING_ID, LISTING_ID])
  })

  it('needs the rights line confirmed', async () => {
    const res = await importSitePhotosAction({ listingId: LISTING_ID, picks, rightsConfirmed: false })
    expect(res).toMatchObject({ ok: false, error: expect.stringContaining('permission') })
    expect(h.imports).toEqual([])
  })

  it('does nothing while the flag is off', async () => {
    h.flag = false
    expect((await importSitePhotosAction({ listingId: LISTING_ID, picks, rightsConfirmed: true })).ok).toBe(false)
    expect(h.imports).toEqual([])
  })

  it('refuses a malformed page id or pick list', async () => {
    expect((await importSitePhotosAction({ listingId: 'abc', picks, rightsConfirmed: true })).ok).toBe(false)
    expect(
      (await importSitePhotosAction({ listingId: LISTING_ID, picks: [{ url: 'x', role: 'banner' }] as never, rightsConfirmed: true })).ok
    ).toBe(false)
    expect(
      (
        await importSitePhotosAction({
          listingId: LISTING_ID,
          picks: [picks[0]!, { ...picks[0]!, url: 'https://glowsalon.com/other.png' }],
          rightsConfirmed: true,
        })
      ).ok
    ).toBe(false)
    expect(h.imports).toEqual([])
  })

  it('caps how many photos come in at once', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ url: `https://glowsalon.com/${i}.jpg`, role: 'gallery' as const }))
    expect(await importSitePhotosAction({ listingId: LISTING_ID, picks: many, rightsConfirmed: true })).toMatchObject({
      ok: false,
      error: expect.stringContaining('up to 6'),
    })
  })

  it('reports a private address as unreachable without fetching it', async () => {
    const res = await importSitePhotosAction({
      listingId: LISTING_ID,
      picks: [{ url: 'http://10.0.0.5/a.jpg', role: 'gallery' }],
      rightsConfirmed: true,
    })
    expect(res).toMatchObject({ ok: true, photos: [{ ok: false, reason: 'unreachable' }] })
    expect(h.imports).toEqual([])
  })

  it('skips the remaining gallery photos once the plan is full, but still brings in the cover', async () => {
    h.importResult = (url) =>
      url.endsWith('chair.jpg')
        ? { ok: false, reason: 'plan_limit', message: 'Your plan includes 1 photo.' }
        : { ok: true, path: 'p', mediaId: null }
    const res = await importSitePhotosAction({
      listingId: LISTING_ID,
      picks: [
        { url: 'https://glowsalon.com/chair.jpg', role: 'gallery' },
        { url: 'https://glowsalon.com/sink.jpg', role: 'gallery' },
        { url: 'https://glowsalon.com/front.jpg', role: 'cover' },
      ],
      rightsConfirmed: true,
    })
    expect(res).toMatchObject({
      ok: true,
      photos: [
        { ok: false, reason: 'plan_limit' },
        { ok: false, reason: 'skipped', message: 'Your plan includes 1 photo.' },
        { ok: true, role: 'cover' },
      ],
    })
    expect(h.imports.map((i) => i.url)).toEqual(['https://glowsalon.com/chair.jpg', 'https://glowsalon.com/front.jpg'])
  })

  it('stops the rate-limited owner before any download', async () => {
    h.rateOk = false
    expect(await importSitePhotosAction({ listingId: LISTING_ID, picks, rightsConfirmed: true })).toMatchObject({ ok: false })
    expect(h.imports).toEqual([])
  })
})
