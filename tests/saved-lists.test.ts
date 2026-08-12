// =============================================================================
// Saved lists — name validation + RLS policy guard
// =============================================================================
// Two things are worth locking down for checkpoint 3.5b:
//
//   1. `lib/saved-lists/name.ts` must agree with the migration's constraint
//      exactly. The DB uses two-argument `btrim(name, E' \t\r\n')`; a client
//      trim that differs by even one character means names the form accepts get
//      rejected by Postgres (or vice versa), and the user sees a 500 for what
//      is really a validation message.
//
//   2. All seven saved-list RLS policies must exist. `/account/saved` reads
//      both tables through the user-scoped client, so a dropped policy does not
//      throw — it default-denies and silently empties the page. Guarded by
//      parsing the real migration SQL, the same way tests/account-surfaces.test.ts
//      guards the analytics_events self-read policy.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import {
  normalizeListName,
  listNameKey,
  validateListName,
  MAX_LIST_NAME_LENGTH,
} from '@/lib/saved-lists/name'

// ── Name normalization ──────────────────────────────────────────────────────

describe('normalizeListName', () => {
  it('trims spaces, tabs, CR and LF — the DB btrim set', () => {
    expect(normalizeListName('  Weekend spots  ')).toBe('Weekend spots')
    expect(normalizeListName('\tWeekend spots\n')).toBe('Weekend spots')
    expect(normalizeListName('\r\n Weekend spots \r\n')).toBe('Weekend spots')
  })

  it('leaves interior whitespace alone', () => {
    expect(normalizeListName('  Date  night  ')).toBe('Date  night')
  })

  it('leaves a clean name untouched', () => {
    expect(normalizeListName('Weekend spots')).toBe('Weekend spots')
  })
})

describe('listNameKey', () => {
  it('matches the unique index expression: lower(btrim(...))', () => {
    expect(listNameKey('  Weekend Spots ')).toBe('weekend spots')
  })

  it('collides for names differing only by case or padding', () => {
    expect(listNameKey('BRUNCH')).toBe(listNameKey('  brunch  '))
  })
})

// ── Validation against the CHECK constraint ─────────────────────────────────

describe('validateListName', () => {
  it('rejects an empty name', () => {
    const result = validateListName('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('empty')
  })

  it('rejects a whitespace-only name — including tabs and newlines', () => {
    // One-argument btrim() would strip only spaces and let "\t" through as a
    // one-character name. This is the case that regression guards.
    for (const raw of ['   ', '\t', '\n', '\r\n', ' \t\r\n ']) {
      const result = validateListName(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('empty')
    }
  })

  it('accepts a name at exactly the maximum length', () => {
    const result = validateListName('a'.repeat(MAX_LIST_NAME_LENGTH))
    expect(result.ok).toBe(true)
  })

  it('rejects a name one character over the maximum', () => {
    const result = validateListName('a'.repeat(MAX_LIST_NAME_LENGTH + 1))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too_long')
  })

  it('measures length after trimming, as the CHECK does', () => {
    const padded = `  ${'a'.repeat(MAX_LIST_NAME_LENGTH)}  `
    const result = validateListName(padded)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.name).toHaveLength(MAX_LIST_NAME_LENGTH)
  })

  it('returns the normalized name so callers store what was validated', () => {
    const result = validateListName('\t Weekend spots \n')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.name).toBe('Weekend spots')
  })
})

// ── RLS policies must survive ───────────────────────────────────────────────

describe('saved-list RLS policies', () => {
  // Concatenate every migration in filename order. Later files win, so a
  // subsequent DROP POLICY without a matching CREATE is visible here.
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

  const POLICIES = [
    'saved_lists: authenticated read own',
    'saved_lists: authenticated insert own',
    'saved_lists: authenticated update own',
    'saved_lists: authenticated delete own',
    'saved_list_items: authenticated read own',
    'saved_list_items: authenticated insert own',
    'saved_list_items: authenticated delete own',
  ]

  it.each(POLICIES)('defines policy "%s"', (name) => {
    expect(activeSql()).toContain(`CREATE POLICY "${name}"`)
  })

  it('enables RLS on both tables', () => {
    const sql = activeSql()
    expect(sql).toContain('ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('ALTER TABLE saved_list_items ENABLE ROW LEVEL SECURITY')
  })

  it('grants no policy to anon — lists are private', () => {
    const savedListBlock = activeSql()
      .split('CREATE POLICY')
      .filter((block) => block.startsWith(' "saved_list'))
    expect(savedListBlock).toHaveLength(POLICIES.length)
    for (const block of savedListBlock) {
      expect(block).toContain('TO authenticated')
      expect(block).not.toContain('TO anon')
    }
  })

  it('constrains the name with the same btrim set the client uses', () => {
    expect(activeSql()).toContain(
      `char_length(btrim(name, E' \\t\\r\\n')) BETWEEN 1 AND ${MAX_LIST_NAME_LENGTH}`
    )
  })
})
