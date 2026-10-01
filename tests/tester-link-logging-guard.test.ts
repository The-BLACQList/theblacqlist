import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// A one-tap link is a login. This guard reads the link's source files and fails
// if any console call passes a variable that could hold the token, its hash,
// the link or an email. String literals are stripped first, so a log label
// such as '[redeemTesterInvite] claim' is fine.

const FILES = [
  'lib/tester/links.ts',
  'lib/tester/redeem.ts',
  'lib/actions/admin/testerLinks.ts',
  'lib/actions/tester/redeemTesterLink.ts',
  'app/t/page.tsx',
  'app/t/StartTourButton.tsx',
  'components/admin/TesterLinkCard.tsx',
]

const FORBIDDEN = /\b(token|tokenHash|token_hash|hashedToken|hashed_token|link|email|p_email|p_token_hash|formData|fromHash)\b/

function consoleCalls(source: string): string[] {
  const calls: string[] = []
  const re = /console\.\w+\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < source.length && depth > 0) {
      if (source[i] === '(') depth++
      else if (source[i] === ')') depth--
      i++
    }
    calls.push(source.slice(m.index + m[0].length, i - 1))
  }
  return calls
}

function withoutStrings(args: string): string {
  return args.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, "''")
}

describe('one-tap tester link logging', () => {
  it.each(FILES)('%s logs no token, hash, link or email', (file) => {
    const source = readFileSync(path.resolve(__dirname, '..', file), 'utf8')
    for (const args of consoleCalls(source)) {
      expect(withoutStrings(args), `console call in ${file}: ${args}`).not.toMatch(FORBIDDEN)
    }
  })

  it('finds the console calls it is guarding', () => {
    const source = readFileSync(path.resolve(__dirname, '..', 'lib/tester/redeem.ts'), 'utf8')
    expect(consoleCalls(source).length).toBeGreaterThan(0)
  })
})
