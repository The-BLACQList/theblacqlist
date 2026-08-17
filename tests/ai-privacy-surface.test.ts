// =============================================================================
// AI privacy surface, guarded by parsing source
// =============================================================================
// The AI safety plan names fields that must never reach a prompt: owner and user
// identifiers, phone, email, address lines, zip, social handles, claim and
// verification document content, and individual analytics or spend rows. Runtime
// tests can only check the values a given context object happens to carry; these
// check the queries themselves, which is where the mistake would actually be
// made — one widened `select` and the forbidden column is in memory next to the
// allowlisted ones.
//
// Same technique as tests/aggregate-privacy.test.ts and
// tests/spend-vocabulary.test.ts: vitest runs environment: 'node', so source
// parsing is how server-only modules get asserted here.
//
// Non-vacuity: swapping the context loader's select for `select('*')` fails the
// first block; adding a console.log of the prompt fails the third.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/**
 * Strips comments before scanning.
 *
 * Both files document the forbidden fields by name — that documentation is the
 * point of them. Scanning the raw text would flag `// no phone, email, or zip`
 * as a violation and make the guard unmaintainable, so the assertions run
 * against code only.
 */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ')
}

const CONTEXT = codeOnly(read('lib/ai/context.ts'))
const PROVIDER = codeOnly(read('lib/ai/provider.ts'))

/** Columns that must not appear in any select inside the AI context loader. */
const FORBIDDEN_COLUMNS = [
  'phone',
  'email',
  'address_line_1',
  'address_line_2',
  'zip',
  'owner_user_id',
  'social_instagram',
  'social_facebook',
  'social_tiktok',
  'social_youtube',
  'social_twitter',
  'social_linkedin',
]

describe('lib/ai/context.ts — the only prompt-context loader', () => {
  it('selects no column that carries personal or contact data', () => {
    for (const column of FORBIDDEN_COLUMNS) {
      expect(CONTEXT, `context loader must not read ${column}`).not.toContain(column)
    }
  })

  it('never selects everything', () => {
    // `select('*')` would defeat the allowlist without changing the type of what
    // is returned — the failure mode this whole file exists to catch.
    expect(CONTEXT).not.toContain("select('*')")
    expect(CONTEXT).not.toContain('select("*")')
  })

  it('reads analytics as counts, not rows', () => {
    // Individual analytics_events rows are named in the safety plan. Head counts
    // return a number and no row data at all.
    expect(CONTEXT).toContain("head: true")
    expect(CONTEXT).not.toContain('properties,')
  })

  it('does not touch claims, verification documents, or spend events', () => {
    for (const table of ['claims', 'verification', 'spend_events', 'receipts']) {
      expect(CONTEXT, `context loader must not read ${table}`).not.toContain(`from('${table}`)
    }
  })
})

describe('lib/ai/provider.ts — the generation seam', () => {
  it('logs neither prompt nor response text', () => {
    // An error type goes into ai_generation_requests.error_message; prompt and
    // response text go nowhere. A console.log here would put owner copy into
    // Vercel's runtime logs, which is not a store we manage retention for.
    expect(PROVIDER).not.toContain('console.log')
    expect(PROVIDER).not.toContain('console.error')
    expect(PROVIDER).not.toContain('console.warn')
  })

  it('carries the triggering user for the audit row and never into prompt vars', () => {
    expect(PROVIDER).toContain('triggeredBy')
    // buildPromptVars is the whole prompt input. If triggeredBy appeared inside
    // it, a user ID would be in the prompt.
    const varsBlock = PROVIDER.slice(
      PROVIDER.indexOf('export function buildPromptVars'),
      PROVIDER.indexOf('function mockContextOf')
    )
    expect(varsBlock.length).toBeGreaterThan(0)
    expect(varsBlock).not.toContain('triggeredBy')
  })

  it('has no live provider call to make', () => {
    // `[Decision — GATE-SPEND pending]` The real call site throws rather than
    // being a plausible stub, so no future edit turns it on by accident.
    expect(PROVIDER).toContain('provider_not_wired')
  })
})

describe('AI server modules stay on the server', () => {
  function collectFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`
      if (entry.isDirectory()) collectFiles(rel, out)
      else if (rel.endsWith('.tsx') || rel.endsWith('.ts')) out.push(rel)
    }
    return out
  }

  it('is never imported by a client component', () => {
    // lib/ai/provider.ts and lib/ai/context.ts use the service-role client. A
    // "use client" file importing either would ship that import path into a
    // browser bundle.
    const files = [...collectFiles('components'), ...collectFiles('app')]
    const offenders = files.filter((rel) => {
      const src = read(rel)
      if (!src.startsWith("'use client'") && !src.startsWith('"use client"')) return false
      return src.includes('@/lib/ai/provider') || src.includes('@/lib/ai/context')
    })
    expect(offenders).toEqual([])
  })
})
