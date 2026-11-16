import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  REVIEWER_EMAIL_RE,
  SEED_ASSET_ROOT,
  SEED_SLUG_PREFIX,
  assetFile,
  buildSeedPlans,
  placeholderPdf,
  priceCents,
  reviewerEmail,
  seedSlugs,
} from '@/scripts/lib/example-seed-plan'

// Ticket 187: every row the staging seed writes passes the table CHECKs, and
// the seed never touches money tables or prints a password.

const NOW = new Date('2026-11-15T15:00:00Z')
const plans = buildSeedPlans(NOW)
const DAY = 24 * 60 * 60 * 1000

describe('listings', () => {
  it('builds the three sample pages, clearly marked as demo', () => {
    expect(plans.map((p) => p.listing.slug)).toEqual([
      `${SEED_SLUG_PREFIX}-storefront`,
      `${SEED_SLUG_PREFIX}-professional`,
      `${SEED_SLUG_PREFIX}-creative`,
    ])
    for (const p of plans) expect(p.listing.name).toMatch(/^Demo — Test Business 123 \(/)
  })

  it('gives every seeded listing a unique slug under the demo prefix', () => {
    const slugs = seedSlugs(plans)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) {
      expect(s.startsWith(`${SEED_SLUG_PREFIX}-`)).toBe(true)
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('marks every location and job as demo, and files jobs under their page', () => {
    for (const p of plans) {
      for (const l of p.locations) expect(l.listing.name.startsWith('Demo — ')).toBe(true)
      expect(p.jobs.length).toBeGreaterThan(0)
      for (const j of p.jobs) {
        expect(j.listing.name.startsWith('Demo — ')).toBe(true)
        expect(j.listing.entity_type).toBe('job')
        // Filed under the hiring page's category: staging has no 'jobs' one.
        expect(j.listing.category_slug).toBe(p.listing.category_slug)
        expect([
          'full-time',
          'part-time',
          'contract',
          'temporary',
          'internship',
          'volunteer',
        ]).toContain(j.details.employment_type)
      }
    }
  })
})

describe('photos', () => {
  it('only names sample photos that exist', () => {
    for (const p of plans) {
      const files = [
        p.cover?.file,
        p.logo?.file,
        ...p.gallery.map((g) => g.file),
        ...p.posts.map((x) => x.photo),
        ...p.shop.map((x) => x.photo),
      ].filter((f): f is string => Boolean(f))
      expect(files.length).toBeGreaterThan(10)
      for (const f of files) expect(existsSync(join(process.cwd(), SEED_ASSET_ROOT, f))).toBe(true)
    }
  })

  it('keeps album names within the media_attachments CHECK', () => {
    for (const p of plans)
      for (const g of p.gallery) if (g.album) expect(g.album.trim().length).toBeLessThanOrEqual(40)
  })

  it('reads only /images/example paths', () => {
    expect(assetFile('/images/example/cafe-cover.webp')).toBe('cafe-cover.webp')
    expect(assetFile('/images/other/x.webp')).toBeNull()
    expect(assetFile('/images/example/../secret.webp')).toBeNull()
    expect(assetFile('https://example.com/x.webp')).toBeNull()
    expect(assetFile(null)).toBeNull()
  })
})

describe('child rows match their table CHECKs', () => {
  it('posts', () => {
    for (const p of plans)
      for (const x of p.posts) {
        expect(x.headline.trim().length).toBeGreaterThan(0)
        expect(x.headline.length).toBeLessThanOrEqual(80)
        if (x.body) expect(x.body.length).toBeLessThanOrEqual(200)
        const start = Date.parse(x.starts_at)
        const end = Date.parse(x.ends_at)
        expect(end).toBeGreaterThan(start)
        expect(end - start).toBeLessThanOrEqual(30 * DAY)
        expect(start).toBeLessThanOrEqual(NOW.getTime())
        if (x.button_label) {
          expect(x.button_label.length).toBeLessThanOrEqual(30)
          expect(x.button_url).toMatch(/^https:\/\//)
        } else expect(x.button_url).toBeNull()
      }
  })

  it('deals', () => {
    for (const p of plans)
      for (const d of p.deals) {
        if (d.code !== null) expect(d.code).toMatch(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/)
        expect(d.status).toBe('active')
        if (d.ends_at !== null)
          expect(Date.parse(d.ends_at as string)).toBeGreaterThan(NOW.getTime())
      }
  })

  it('buttons', () => {
    for (const p of plans)
      for (const b of p.buttons) {
        expect(b.type).toBe('learn-more')
        expect(b.value).toMatch(/^https:\/\//)
        expect((b.label_override as string).length).toBeLessThanOrEqual(50)
      }
  })

  it('links and videos', () => {
    const types = [
      'website',
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
      'linkedin',
      'twitter',
      'booking',
      'menu',
      'order',
      'other',
    ]
    for (const p of plans) {
      for (const l of p.links) expect(types).toContain(l.link_type)
      for (const v of p.videos) expect(v.embed_url).toMatch(/^https:\/\//)
    }
  })

  it('team: at most one founder, short roles and bios', () => {
    for (const p of plans) {
      expect(p.team.filter((m) => m.is_founder).length).toBeLessThanOrEqual(1)
      for (const m of p.team) {
        expect((m.name as string).length).toBeLessThanOrEqual(80)
        if (m.role) expect((m.role as string).length).toBeLessThanOrEqual(60)
        if (m.bio) expect((m.bio as string).length).toBeLessThanOrEqual(400)
      }
    }
  })

  it('credentials', () => {
    for (const p of plans)
      for (const c of p.credentials) {
        expect(['license', 'certification', 'award', 'press']).toContain(c.kind)
        expect((c.title as string).length).toBeLessThanOrEqual(80)
        if (c.issuer) expect((c.issuer as string).length).toBeLessThanOrEqual(80)
        if (c.url !== null) expect(c.url).toMatch(/^https:\/\//)
      }
  })

  it('documents', () => {
    for (const p of plans)
      for (const d of p.documents) {
        expect(d.label.trim().length).toBeGreaterThan(0)
        expect(d.label.length).toBeLessThanOrEqual(60)
      }
  })

  it('special hours', () => {
    for (const p of plans)
      for (const o of p.hoursOverrides) {
        if (o.closed) {
          expect(o.open).toBeNull()
          expect(o.close).toBeNull()
        } else {
          expect(o.open).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
          expect(o.close).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
          expect((o.close as string) > (o.open as string)).toBe(true)
        }
        expect(Date.parse(`${o.date as string}T23:59:59Z`)).toBeGreaterThan(NOW.getTime())
      }
  })

  it('order-on links and stockists', () => {
    for (const p of plans) {
      for (const o of p.orderPlatforms) {
        expect(['doordash', 'grubhub', 'instacart', 'ubereats']).toContain(o.platform)
        expect(o.url).toMatch(/^https:\/\/\S+$/)
      }
      for (const s of p.stockists) {
        expect((s.chain_slug === null) !== (s.store_name === null)).toBe(true)
        for (const a of s.areas) {
          if (a.kind === 'zip') expect(a.value).toMatch(/^[0-9]{5}$/)
          else expect(a.value).toMatch(/^[^,]+, [A-Z]{2}$/)
        }
      }
    }
  })

  it('shop items have demo slugs and a price', () => {
    const globals = plans.flatMap((p) => p.shop.map((s) => s.global_slug))
    expect(new Set(globals).size).toBe(globals.length)
    for (const p of plans)
      for (const s of p.shop) {
        expect(s.slug.startsWith('demo-')).toBe(true)
        expect(s.global_slug.startsWith(`${SEED_SLUG_PREFIX}-`)).toBe(true)
        expect(s.price_cents).toBeGreaterThan(0)
      }
  })
})

describe('helpers', () => {
  it('reads prices', () => {
    expect(priceCents('$19')).toBe(1900)
    expect(priceCents('From $17/mo')).toBe(1700)
    expect(priceCents('$1,200')).toBe(120000)
    expect(priceCents('$4.50')).toBe(450)
    expect(priceCents('Free')).toBeNull()
    expect(priceCents(null)).toBeNull()
  })

  it('names reviewer accounts on example.com only', () => {
    expect(reviewerEmail(3)).toBe('demo-reviewer-3@example.com')
    expect(REVIEWER_EMAIL_RE.test(reviewerEmail(12))).toBe(true)
    expect(REVIEWER_EMAIL_RE.test('demo-reviewer-1@example.com.evil.test')).toBe(false)
    expect(REVIEWER_EMAIL_RE.test('someone@gmail.com')).toBe(false)
  })

  it('writes a well-formed PDF', () => {
    const bytes = placeholderPdf('Full menu (PDF) — Café')
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(bytes.length).toBe(text.length) // ASCII only
    const xref = Number(text.match(/startxref\n(\d+)/)?.[1])
    expect(text.slice(xref, xref + 4)).toBe('xref')
  })
})

describe('the seed script', () => {
  const src = readFileSync(join(process.cwd(), 'scripts/seed-example-business.ts'), 'utf8')

  it('never writes a money table', () => {
    const tables = [...src.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1])
    for (const t of tables)
      expect(t).not.toMatch(
        /payment|purchase|receipt|payout|order(?!_platforms)|charge|invoice|subscription/
      )
  })

  it('never prints a password, and makes each one random', () => {
    const lines = src
      .split('\n')
      .filter((l) => /password/i.test(l) && !/^\s*(\/\*\*|\*)/.test(l))
      .map((l) => l.trim())
    expect(lines.sort()).toEqual([
      'function reviewerPassword(): string {',
      'password: reviewerPassword(),',
    ])
    for (const l of src.split('\n')) if (/console\./.test(l)) expect(l).not.toMatch(/password/i)
    expect(src).toMatch(/return `\$\{randomBytes\(24\)\.toString\('base64url'\)\}aA1!`/)
  })

  it('checks the target before creating a client', () => {
    expect(src.indexOf('assertTargetConfirmed(url')).toBeGreaterThan(0)
    expect(src.indexOf('assertTargetConfirmed(url')).toBeLessThan(src.indexOf('createClient(url'))
  })
})
