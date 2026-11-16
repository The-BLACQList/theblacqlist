import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PRODUCTION_REF,
  STAGING_REF,
  assertTargetConfirmed,
  checkSeedTarget,
  describeTarget,
  flagValue,
  hasFlag,
} from '@/scripts/lib/seed-guards'

// Ticket 187: the demo seeds can never write to production, write to staging
// only when told --yes, and run on local without ceremony.

const PROD = `https://${PRODUCTION_REF}.supabase.co`
const STAGING = `https://${STAGING_REF}.supabase.co`

describe('checkSeedTarget', () => {
  it('refuses production, with or without --yes', () => {
    expect(checkSeedTarget(PROD, []).ok).toBe(false)
    expect(checkSeedTarget(PROD, ['--yes']).ok).toBe(false)
    expect(checkSeedTarget(PROD.toUpperCase(), ['--yes']).ok).toBe(false)
    expect(checkSeedTarget(`${PROD}/rest/v1`, ['--yes']).ok).toBe(false)
  })

  it('says why production is refused', () => {
    const result = checkSeedTarget(PROD, ['--yes'])
    expect(!result.ok && result.reason).toMatch(/PRODUCTION/)
  })

  it('runs locally without --yes', () => {
    for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://db.local']) {
      expect(checkSeedTarget(url, [])).toMatchObject({ ok: true, target: { isLocal: true } })
    }
  })

  it('needs --yes for staging', () => {
    expect(checkSeedTarget(STAGING, []).ok).toBe(false)
    expect(checkSeedTarget(STAGING, ['--yes'])).toMatchObject({
      ok: true,
      target: { ref: STAGING_REF, isLocal: false },
    })
  })

  it('refuses any other remote project, even with --yes', () => {
    expect(checkSeedTarget('https://abcdefghijklmnopqrst.supabase.co', ['--yes']).ok).toBe(false)
    expect(checkSeedTarget('https://example.com', ['--yes']).ok).toBe(false)
    // A look-alike host that only contains the staging name.
    expect(checkSeedTarget(`https://${STAGING_REF}.supabase.co.example.com`, ['--yes']).ok).toBe(
      false
    )
    expect(checkSeedTarget(`https://${STAGING_REF}.example.com`, ['--yes']).ok).toBe(false)
  })

  it('refuses something that is not a URL', () => {
    expect(checkSeedTarget('not a url', ['--yes']).ok).toBe(false)
    expect(checkSeedTarget('', ['--yes']).ok).toBe(false)
  })

  it('does not treat --yes=no or a lookalike flag as --yes', () => {
    expect(checkSeedTarget(STAGING, ['--yes=no']).ok).toBe(false)
    expect(checkSeedTarget(STAGING, ['--yess']).ok).toBe(false)
  })
})

describe('describeTarget', () => {
  it('reads the project ref from a supabase.co host', () => {
    expect(describeTarget(STAGING)).toEqual({
      host: `${STAGING_REF}.supabase.co`,
      ref: STAGING_REF,
      isLocal: false,
    })
  })
})

describe('assertTargetConfirmed', () => {
  afterEach(() => vi.restoreAllMocks())

  function stubExit() {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`)
    }) as never)
  }

  it('exits on production', () => {
    const exit = stubExit()
    expect(() => assertTargetConfirmed(PROD, ['--yes'])).toThrow('exit 1')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('returns the target when allowed', () => {
    const exit = stubExit()
    expect(assertTargetConfirmed(STAGING, ['--yes']).ref).toBe(STAGING_REF)
    expect(exit).not.toHaveBeenCalled()
  })
})

describe('flags', () => {
  it('reads presence and values', () => {
    const argv = ['node', 'x.ts', '--purge', '--owner-email= a@b.test ']
    expect(hasFlag(argv, '--purge')).toBe(true)
    expect(hasFlag(argv, '--yes')).toBe(false)
    expect(flagValue(argv, '--owner-email')).toBe('a@b.test')
    expect(flagValue(argv, '--missing')).toBe('')
  })
})

describe('the seed scripts use the shared guard', () => {
  for (const file of ['seed-marketplace-demo.ts', 'seed-example-business.ts']) {
    it(file, () => {
      const src = readFileSync(join(process.cwd(), 'scripts', file), 'utf8')
      expect(src).toContain("from './lib/seed-guards'")
      expect(src).toMatch(/assertTargetConfirmed\(/)
      expect(src).not.toMatch(/function assertTargetConfirmed/)
    })
  }
})
