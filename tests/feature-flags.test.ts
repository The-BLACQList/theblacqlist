// =============================================================================
// Checkpoint X.1 — the feature-flag layer
// =============================================================================
// What matters here is not that a boolean round-trips. It is that the two
// defaults hold under every way the configuration can be wrong, because those
// defaults are the whole safety property:
//
//   * unset in production  -> OFF, so merging a half-finished surface to `main`
//     is safe at any point
//   * unset in preview     -> ON, so it actually gets reviewed before launch
//   * garbage in production -> OFF, not "truthy string wins"
//
// IS_PRODUCTION is resolved at module scope from VERCEL_ENV, so every case has
// to set the environment and then re-import. vi.resetModules() in beforeEach is
// what makes that honest rather than order-dependent.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return import('@/lib/env')
}

beforeEach(() => {
  // VERCEL_ENV decides IS_PRODUCTION, so no test may inherit another's.
  delete process.env.VERCEL_ENV
  delete process.env.NEXT_PUBLIC_VERCEL_ENV
  delete process.env.FEATURE_AI_BETA
  delete process.env.FEATURE_OCR_EXTRACTION
  // Added 2026-08-21 with the E-2 Model C work. Its absence was latent rather
  // than harmless: `getEnabledFeatures` below asserts the full flag list, so a
  // developer or CI runner with FEATURE_PAID_POSTINGS=0 in their shell would
  // have failed that case for a reason that had nothing to do with the code.
  delete process.env.FEATURE_PAID_POSTINGS
  delete process.env.FEATURE_POSTING_SUBMISSIONS
  delete process.env.FEATURE_TESTER_TOUR
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isFeatureEnabled — defaults', () => {
  it('is OFF in production when the env var is unset', async () => {
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'production' })
    expect(isFeatureEnabled('aiBeta')).toBe(false)
  })

  it('is ON in preview when the env var is unset', async () => {
    // Previews are where a flagged surface gets reviewed. Defaulting them off
    // would mean nobody ever sees the thing before it launches.
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'preview' })
    expect(isFeatureEnabled('aiBeta')).toBe(true)
  })

  it('is ON in local development when the env var is unset', async () => {
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'development' })
    expect(isFeatureEnabled('aiBeta')).toBe(true)
  })

  // The same two defaults, asserted for `paidPostings` specifically. The generic
  // cases above run on `aiBeta`, which would keep passing if someone gave the
  // money path its own default. This is the flag that gates job checkout, the
  // included-job allowance, the event caps, and the job half of the nightly
  // sweep — production has to stay dark until STRIPE_JOB_POSTING_PRICE_ID exists
  // at every Vercel scope (§2B5 step 4), and "dark" is exactly this default.
  it('keeps paidPostings OFF in production when the env var is unset', async () => {
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'production' })
    expect(isFeatureEnabled('paidPostings')).toBe(false)
  })

  it('turns paidPostings ON in preview when the env var is unset', async () => {
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'preview' })
    expect(isFeatureEnabled('paidPostings')).toBe(true)
  })
})

describe('isFeatureEnabled — explicit values', () => {
  it('turns a feature on in production when explicitly set', async () => {
    // This is the whole point of the checkpoint: production is off by default
    // and one env var flips it, with no code change.
    const { isFeatureEnabled } = await loadEnv({
      VERCEL_ENV: 'production',
      FEATURE_AI_BETA: 'true',
    })
    expect(isFeatureEnabled('aiBeta')).toBe(true)
  })

  it('turns a feature off in preview when explicitly set', async () => {
    const { isFeatureEnabled } = await loadEnv({
      VERCEL_ENV: 'preview',
      FEATURE_AI_BETA: 'false',
    })
    expect(isFeatureEnabled('aiBeta')).toBe(false)
  })

  it.each(['1', 'true', 'TRUE', 'on', 'yes', 'enabled', '  true  '])(
    'reads %o as on',
    async (raw) => {
      const { isFeatureEnabled } = await loadEnv({
        VERCEL_ENV: 'production',
        FEATURE_AI_BETA: raw,
      })
      expect(isFeatureEnabled('aiBeta')).toBe(true)
    }
  )

  it.each(['0', 'false', 'FALSE', 'off', 'no', 'disabled'])('reads %o as off', async (raw) => {
    const { isFeatureEnabled } = await loadEnv({
      VERCEL_ENV: 'preview',
      FEATURE_AI_BETA: raw,
    })
    expect(isFeatureEnabled('aiBeta')).toBe(false)
  })
})

describe('isFeatureEnabled — malformed configuration fails closed', () => {
  it.each(['maybe', 'ON!', 'y', '2', 'null'])(
    'leaves a feature OFF in production when the value is %o',
    async (raw) => {
      // A typo must not switch a surface on. Anything unrecognized falls back to
      // the per-environment default, which in production is off.
      const { isFeatureEnabled } = await loadEnv({
        VERCEL_ENV: 'production',
        FEATURE_AI_BETA: raw,
      })
      expect(isFeatureEnabled('aiBeta')).toBe(false)
    }
  )

  it.each(['', '   '])('treats %o as unset rather than as false', async (raw) => {
    // An empty var is Vercel's shape for "declared but never filled in". It has
    // to mean "no opinion", not "off", or the preview default would be
    // unreachable for anyone who created the var and left it blank.
    const { isFeatureEnabled } = await loadEnv({
      VERCEL_ENV: 'preview',
      FEATURE_AI_BETA: raw,
    })
    expect(isFeatureEnabled('aiBeta')).toBe(true)
  })
})

describe('isFeatureEnabled — flags are independent', () => {
  it('does not let one flag leak into another', async () => {
    const { isFeatureEnabled } = await loadEnv({
      VERCEL_ENV: 'production',
      FEATURE_AI_BETA: 'true',
    })
    expect(isFeatureEnabled('aiBeta')).toBe(true)
    expect(isFeatureEnabled('ocrExtraction')).toBe(false)
  })

  it('reads process.env at call time, not at import time', async () => {
    // getAppUrl() is a function for this same reason. A frozen const map would
    // resolve once, at an unpredictable moment, and could not be tested at all.
    const { isFeatureEnabled } = await loadEnv({ VERCEL_ENV: 'production' })
    expect(isFeatureEnabled('aiBeta')).toBe(false)

    process.env.FEATURE_AI_BETA = 'true'
    expect(isFeatureEnabled('aiBeta')).toBe(true)
  })
})

describe('getEnabledFeatures', () => {
  it('lists nothing in a bare production deployment', async () => {
    const { getEnabledFeatures } = await loadEnv({ VERCEL_ENV: 'production' })
    expect(getEnabledFeatures()).toEqual([])
  })

  it('lists every flag in a bare preview deployment', async () => {
    const { getEnabledFeatures } = await loadEnv({ VERCEL_ENV: 'preview' })
    expect(getEnabledFeatures().sort()).toEqual([
      'aiBeta',
      'ocrExtraction',
      'paidPostings',
      'postingSubmissions',
      'testerTour',
    ])
  })

  it('lists only what is switched on in production', async () => {
    const { getEnabledFeatures } = await loadEnv({
      VERCEL_ENV: 'production',
      FEATURE_OCR_EXTRACTION: 'on',
    })
    expect(getEnabledFeatures()).toEqual(['ocrExtraction'])
  })
})
