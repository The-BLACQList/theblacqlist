// =============================================================================
// Job entity — JobPosting mapping + migration guardrails
// =============================================================================
// The rendered job page looks identical whether the JSON-LD is correct or
// silently malformed, so the mapping is guarded here rather than by eye:
//
//   * formatSalary()          — what a visitor reads as the pay line
//   * buildJobPostingJsonLd() — what Google reads for Jobs eligibility. A Place
//     on a remote role, or a baseSalary without a unit, is a validation error
//     that costs the listing its rich result and shows up nowhere in the UI.
//   * the migration SQL       — all five listing_details_job policies and the
//     eight-value entity_type CHECK, in the style of account-surfaces.test.ts,
//     so dropping one fails CI instead of 404-ing every job page.
//   * the two apply forms     — the apply-link / apply-email pair is a one-of
//     rule on the server, so the required marker belongs on the fieldset legend
//     and neither input may carry `required` (debt ⑱).
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { formatSalary, buildJobPostingJsonLd } from '@/lib/listings/jobPosting'
import type { EntityPageData, JobDetails } from '@/types'

// ── fixtures ────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<JobDetails> = {}): JobDetails {
  return {
    description: 'Run the line, train the crew, keep the pass moving.',
    employment_type: 'full-time',
    workplace_type: 'on-site',
    salary_min: 22,
    salary_max: 28,
    salary_period: 'hour',
    salary_currency: 'USD',
    apply_url: 'https://example.com/apply',
    apply_email: null,
    posted_at: '2026-08-01T12:00:00.000Z',
    closes_at: null,
    cta_type: 'apply',
    cta_url: 'https://example.com/apply',
    hiring: null,
    ...overrides,
  }
}

function makeEntity(job: JobDetails | null): EntityPageData {
  return {
    name: 'Kitchen Lead',
    slug: 'kitchen-lead',
    tagline: 'A lead role on a growing line.',
    city: { slug: 'atlanta-ga', name: 'Atlanta', state_abbr: 'GA' },
    job,
    // Only the fields buildJobPostingJsonLd reads are meaningful here; the rest
    // of EntityPageData is irrelevant to the mapping under test.
  } as unknown as EntityPageData
}

// ── formatSalary ────────────────────────────────────────────────────────────

describe('formatSalary', () => {
  it('returns null when no pay was given, so the row is omitted rather than blank', () => {
    expect(formatSalary(null, null, null, 'USD')).toBeNull()
    expect(formatSalary(null, null, 'hour', 'USD')).toBeNull()
  })

  it('renders a range with the period suffix', () => {
    expect(formatSalary(22, 28, 'hour', 'USD')).toBe('$22 – $28/hr')
  })

  it('renders a single figure when both bounds match', () => {
    expect(formatSalary(65000, 65000, 'year', 'USD')).toBe('$65,000/yr')
  })

  it('renders one-sided ranges as From / Up to', () => {
    expect(formatSalary(20, null, 'hour', 'USD')).toBe('From $20/hr')
    expect(formatSalary(null, 90000, 'year', 'USD')).toBe('Up to $90,000/yr')
  })

  it('keeps cents only when the amount has them', () => {
    expect(formatSalary(18.5, null, 'hour', 'USD')).toBe('From $18.50/hr')
  })

  it('degrades instead of throwing on an unknown currency code', () => {
    // salary_currency is free text in the DB; Intl throws on a bad code, and a
    // thrown formatter would take the whole page down.
    expect(formatSalary(20, null, 'hour', 'NOTACURRENCY')).toBe('From NOTACURRENCY 20/hr')
  })
})

// ── buildJobPostingJsonLd ───────────────────────────────────────────────────

describe('buildJobPostingJsonLd', () => {
  it('returns null when the listing has no job detail row', () => {
    expect(buildJobPostingJsonLd(makeEntity(null), 'job')).toBeNull()
    expect(buildJobPostingJsonLd(null, 'job')).toBeNull()
  })

  it('maps the core JobPosting fields from real columns', () => {
    const jsonLd = buildJobPostingJsonLd(makeEntity(makeJob()), 'job')!
    expect(jsonLd['@type']).toBe('JobPosting')
    expect(jsonLd.title).toBe('Kitchen Lead')
    expect(jsonLd.datePosted).toBe('2026-08-01T12:00:00.000Z')
    expect(jsonLd.employmentType).toBe('FULL_TIME')
  })

  it('omits validThrough when no closing date was set, and emits it when one was', () => {
    expect(buildJobPostingJsonLd(makeEntity(makeJob()), 'job')!).not.toHaveProperty('validThrough')
    const closing = buildJobPostingJsonLd(
      makeEntity(makeJob({ closes_at: '2026-09-30T00:00:00.000Z' })),
      'job'
    )!
    expect(closing.validThrough).toBe('2026-09-30T00:00:00.000Z')
  })

  it('emits a Place for an on-site role', () => {
    const jsonLd = buildJobPostingJsonLd(makeEntity(makeJob()), 'job')!
    expect(jsonLd.jobLocation).toMatchObject({
      '@type': 'Place',
      address: { addressLocality: 'Atlanta', addressRegion: 'GA' },
    })
    expect(jsonLd).not.toHaveProperty('jobLocationType')
  })

  it('drops jobLocation and declares TELECOMMUTE for a remote role', () => {
    // Google rejects a JobPosting that carries both a Place and TELECOMMUTE.
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(makeJob({ workplace_type: 'remote' })),
      'job'
    )!
    expect(jsonLd).not.toHaveProperty('jobLocation')
    expect(jsonLd.jobLocationType).toBe('TELECOMMUTE')
    expect(jsonLd.applicantLocationRequirements).toMatchObject({ '@type': 'Country' })
  })

  it('keeps the Place for a hybrid role — hybrid work still has a location', () => {
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(makeJob({ workplace_type: 'hybrid' })),
      'job'
    )!
    expect(jsonLd.jobLocation).toBeDefined()
    expect(jsonLd).not.toHaveProperty('jobLocationType')
  })

  it('builds baseSalary from both bounds with the schema unitText', () => {
    const jsonLd = buildJobPostingJsonLd(makeEntity(makeJob()), 'job')!
    expect(jsonLd.baseSalary).toMatchObject({
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: { minValue: 22, maxValue: 28, unitText: 'HOUR' },
    })
  })

  it('emits only the bound that was given', () => {
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(makeJob({ salary_min: 65000, salary_max: null, salary_period: 'year' })),
      'job'
    )!
    const value = (jsonLd.baseSalary as { value: Record<string, unknown> }).value
    expect(value.minValue).toBe(65000)
    expect(value).not.toHaveProperty('maxValue')
    expect(value.unitText).toBe('YEAR')
  })

  it('omits baseSalary entirely when no pay was given', () => {
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(makeJob({ salary_min: null, salary_max: null, salary_period: null })),
      'job'
    )!
    expect(jsonLd).not.toHaveProperty('baseSalary')
  })

  it('omits baseSalary when a period is missing rather than emitting a half-formed amount', () => {
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(makeJob({ salary_period: null })),
      'job'
    )!
    expect(jsonLd).not.toHaveProperty('baseSalary')
  })

  it('falls back to the listing itself as hiringOrganization when no company is linked', () => {
    const jsonLd = buildJobPostingJsonLd(makeEntity(makeJob()), 'job')!
    expect(jsonLd.hiringOrganization).toMatchObject({ name: 'Kitchen Lead' })
    expect(jsonLd.hiringOrganization).not.toHaveProperty('sameAs')
  })

  it('uses the linked business as hiringOrganization when one is set', () => {
    const jsonLd = buildJobPostingJsonLd(
      makeEntity(
        makeJob({ hiring: { name: "Marcy's Kitchen", url: '/atlanta-ga/restaurant/marcys' } })
      ),
      'job'
    )!
    const org = jsonLd.hiringOrganization as Record<string, string>
    expect(org.name).toBe("Marcy's Kitchen")
    expect(org.sameAs).toContain('/atlanta-ga/restaurant/marcys')
  })
})

// ── migration guardrails ────────────────────────────────────────────────────

describe('listing_details_job migration', () => {
  // Concatenate every migration in filename order. Later files win, so a
  // subsequent DROP without a matching CREATE is visible here.
  function activeSql(): string {
    const dir = path.resolve(process.cwd(), 'supabase/migrations')
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
  }

  it('keeps all five RLS policies — losing one 404s or leaks every job page', () => {
    const sql = activeSql()
    for (const name of [
      'listing_details_job: anon read published',
      'listing_details_job: authenticated read',
      'listing_details_job: owner insert',
      'listing_details_job: owner update',
      'listing_details_job: owner delete',
    ]) {
      expect(sql, `policy missing: ${name}`).toContain(`CREATE POLICY "${name}"`)
    }
  })

  it('enables RLS on the table', () => {
    expect(activeSql()).toMatch(/ALTER TABLE listing_details_job ENABLE ROW LEVEL SECURITY/i)
  })

  it('leaves the entity_type CHECK holding all eight live types', () => {
    // 20260524000001 dropped 'job' from this CHECK and never restored it, which
    // is why the DB physically rejected a job listing until 20260813000000.
    const sql = activeSql()
    const matches = [...sql.matchAll(/ADD CONSTRAINT listings_entity_type_check[\s\S]*?;/gi)]
    expect(matches.length, 'no entity_type CHECK found').toBeGreaterThan(0)
    const last = matches[matches.length - 1]![0]
    for (const t of [
      'business',
      'restaurant',
      'service_provider',
      'professional',
      'creative',
      'vendor',
      'event',
      'job',
    ]) {
      expect(last, `entity_type CHECK dropped '${t}'`).toContain(`'${t}'`)
    }
  })
})

// ── debt ⑱ — the apply-link / apply-email required marker ────────────────────

/**
 * Both job forms enforce a *one-of* rule on the server: `createListing.ts:240`
 * and `updateJobDetails.ts:72` reject a posting that supplies neither an
 * application link nor an application email, and accept one that supplies
 * either. Before this guard, neither form told the user that — the pair sat in
 * a bare <div> with no required marker anywhere on it, so the rule was only
 * discoverable by submitting and being refused.
 *
 * The marker belongs on the <legend>, and `required` belongs on neither input.
 * Marking a field required would be wrong twice over: the browser would block a
 * posting that filled in the *other* field, and a screen reader would announce
 * a requirement the server does not have. The group is what is required.
 *
 * Read as source text for the same reason as form-input-preservation.test.ts —
 * there is no @testing-library here, and what is under test is a property of
 * the JSX, not of any runtime interaction.
 */

const APPLY_FORMS = [
  {
    label: 'SubmitJobForm (public /add-job)',
    file: 'components/listings/SubmitJobForm.tsx',
  },
  {
    label: 'JobDetailsSection (owner dashboard edit)',
    file: 'components/dashboard/JobDetailsSection.tsx',
  },
] as const

/** The <fieldset>…</fieldset> block that holds the apply pair, or undefined. */
function readApplyFieldset(relPath: string): string | undefined {
  const source = readFileSync(path.resolve(process.cwd(), relPath), 'utf8')

  return source
    .split('<fieldset')
    .slice(1)
    .map((chunk) => {
      const end = chunk.indexOf('</fieldset>')
      // A `<fieldset` with no close means the matcher no longer understands the
      // file; drop the chunk rather than let slice(0, -1) silently truncate it.
      return end === -1 ? null : chunk.slice(0, end)
    })
    .find((chunk): chunk is string => chunk !== null && chunk.includes('name="apply_url"'))
}

describe('debt ⑱ — the apply-link / apply-email group is marked required', () => {
  it.each(APPLY_FORMS)('$label', ({ file }) => {
    const fieldset = readApplyFieldset(file)

    expect(
      fieldset,
      `${file}: the apply_url / apply_email pair is not inside a <fieldset> — there is nowhere to put the required marker`
    ).toBeDefined()
    const block = fieldset as string

    // Both halves of the one-of rule must live in the same group, or the legend
    // is not speaking for the rule the server actually enforces.
    expect(block, `${file}: apply_email is not in the same fieldset as apply_url`).toContain(
      'name="apply_email"'
    )

    const legend = /<legend\b[\s\S]*?<\/legend>/.exec(block)?.[0]
    expect(legend, `${file}: the apply fieldset has no <legend>`).toBeDefined()
    expect(
      legend,
      `${file}: the apply fieldset's legend carries no required marker — the one-of rule is invisible until the server refuses the submission`
    ).toContain('*')

    // Neither input may be `required`: HTML would then demand both, and the
    // server demands either.
    for (const match of block.matchAll(/<input\b([\s\S]*?)\/?>/g)) {
      const attrs = match[1] ?? ''
      const name = /\bname="([^"]*)"/.exec(attrs)?.[1] ?? '(unnamed)'
      expect(
        /\brequired\b/.test(attrs),
        `${file}: <input name="${name}"> is marked required, but the server accepts a posting that supplies only the other field`
      ).toBe(false)
    }
  })
})
