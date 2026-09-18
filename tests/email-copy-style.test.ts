import { readdirSync, readFileSync } from 'fs'
import path from 'path'

import { describe, expect, it } from 'vitest'

/**
 * House rule: no em dashes in anything a user reads. This reads every email
 * template as source and fails on the character itself, so the rule is
 * enforced by the build rather than remembered at review time.
 *
 * Code comments are exempt. Stripping them out before the check means a dash
 * in a JSDoc block explaining a prop does not count against a template.
 */

const TEMPLATES_DIR = path.resolve(process.cwd(), 'lib/email/templates')
const SUBJECT_FILES = [path.resolve(process.cwd(), 'lib/actions/admin/renderTesterInvite.ts')]

const EM_DASH = '—'

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block and JSDoc comments
    .replace(/^\s*\/\/.*$/gm, '') // whole-line comments
    .replace(/\s\/\/.*$/gm, '') // trailing comments
}

function linesWith(source: string, needle: string): number[] {
  return source
    .split('\n')
    .map((line, i) => (line.includes(needle) ? i + 1 : 0))
    .filter(Boolean)
}

const templateFiles = readdirSync(TEMPLATES_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => path.join(TEMPLATES_DIR, name))

describe('email copy style', () => {
  it('finds the templates it is guarding', () => {
    expect(templateFiles.length).toBeGreaterThan(0)
  })

  it.each([...templateFiles, ...SUBJECT_FILES].map((f) => [path.relative(process.cwd(), f), f]))(
    '%s has no em dash outside a comment',
    (_label, file) => {
      const source = stripComments(readFileSync(file, 'utf8'))
      const offending = linesWith(source, EM_DASH)
      expect(offending, `em dash on line(s) ${offending.join(', ')}`).toEqual([])
    }
  )

  it('leaves numeric ranges alone (en dash is not an em dash)', () => {
    // "2–3 business days" is a range. The en dash is correct there and the
    // guard must not flag it.
    expect(stripComments('2–3 business days')).not.toContain(EM_DASH)
  })
})
