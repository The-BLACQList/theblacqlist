import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Ticket 262. The founder (2026-11-21): "Not just BLACQList. Always The
// BLACQList." Anything a visitor can see says "The BLACQList". This scans the
// app, components and lib for a bare "BLACQList" outside comments.

const REPO_ROOT = path.resolve(__dirname, '..')
const ROOTS = ['app', 'components', 'lib']

// Code, not copy: the title-case dictionary entry, the internal license key for
// first-party sample art (never shown), and the crawler user agents.
const ALLOWED = ["blacqlist: 'BLACQList'", 'First-party BLACQList artwork', 'TheBLACQList/1.0']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : []
  })
}

function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('The BLACQList, never bare BLACQList (ticket 262)', () => {
  it('has no bare BLACQList in user-facing code', () => {
    const offenders: string[] = []
    for (const root of ROOTS) {
      for (const file of walk(path.join(REPO_ROOT, root))) {
        let src = stripComments(readFileSync(file, 'utf8'))
        for (const ok of ALLOWED) src = src.split(ok).join('')
        // "The" may sit at the end of the previous line when JSX wraps.
        const re = /(?<!The\s+)BLACQList/g
        let m: RegExpExecArray | null
        while ((m = re.exec(src))) {
          const line = src.slice(0, m.index).split('\n').length
          offenders.push(`${path.relative(REPO_ROOT, file)}:${line}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('names the top tier "Certified by The BLACQList" (founder pick 2026-11-21)', () => {
    // JSX wraps the text, so compare with line breaks folded to spaces.
    const terms = readFileSync(
      path.join(REPO_ROOT, 'app/(public)/terms/TermsOfService.tsx'),
      'utf8'
    ).replace(/\s+/g, ' ')
    expect(terms).toContain('Certified by The BLACQList')
    const label = readFileSync(
      path.join(REPO_ROOT, 'components/entity-page/TrustTierLabel.tsx'),
      'utf8'
    )
    expect(label).toContain("certified: 'Certified by The BLACQList'")
  })
})
