import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Tickets 274 + 275: plan text is never under 14px. Covers Pricing, the plan
// cards For Business shares with it, the dashboard Upgrade page and the pieces
// they render. The browser check is e2e/for-business-brand.spec.ts.
const inDir = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => `${dir}/${f}`)

const FILES = [
  ...inDir('app/(public)/pricing'),
  ...inDir('app/dashboard/upgrade'),
  ...inDir('components/billing'),
  'components/dashboard/PlanPages.tsx',
  'components/marketing/LaunchWaitlist.tsx',
  'components/tour/ClaimTrialButton.tsx',
]

const tooSmall = (src: string) => [
  ...(src.match(/\btext-(?:xs|2xs)\b/g) ?? []),
  ...[...src.matchAll(/\btext-\[([\d.]+)(px|rem)\]/g)]
    .filter(([, n, unit]) => Number(n) * (unit === 'rem' ? 16 : 1) < 14)
    .map(([match]) => match),
]

describe('plan text is at least 14px', () => {
  it.each(FILES)('%s', (file) => {
    expect(tooSmall(readFileSync(file, 'utf8'))).toEqual([])
  })

  it('catches small sizes and passes 14px and up', () => {
    expect(tooSmall('text-xs text-[11px] text-[0.8rem] text-sm text-[14px] text-[1rem]')).toEqual([
      'text-xs',
      'text-[11px]',
      'text-[0.8rem]',
    ])
  })
})
