/**
 * Ticket 283: `cities` has no state_abbr column. PostgREST fails the whole read
 * when an embed asks for it, so /add-job told every owner they had no page.
 * The state comes from `cities(states(code))`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['app', 'lib', 'components']

function sources(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`
    if (e.isDirectory()) return sources(path)
    return /\.tsx?$/.test(e.name) ? [path] : []
  })
}

/** Comments may name the bad select; code may not. */
const code = (path: string) =>
  readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const BAD = /\bcities(?:![\w]+)?\s*\([^)]*\bstate_abbr\b/

describe('city embeds', () => {
  it('spots the bad select', () => {
    expect(BAD.test("select('id, cities(name, state_abbr)')")).toBe(true)
    expect(BAD.test('cities ( name, state_abbr, slug )')).toBe(true)
    expect(BAD.test('cities(name, states(code))')).toBe(false)
  })

  it('never ask cities for state_abbr', () => {
    expect(ROOTS.flatMap(sources).filter((p) => BAD.test(code(p)))).toEqual([])
  })
})
