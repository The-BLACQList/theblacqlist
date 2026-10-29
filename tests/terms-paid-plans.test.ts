import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { TERMS_PAID_PLANS } from '@/lib/legal/policyUpdate'

// Ticket 144: Terms section 13 and the plan card's link to it.
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf8')
const terms = read('app/(public)/terms/TermsOfService.tsx')
const upgrade = read('app/dashboard/upgrade/UpgradePlans.tsx')

describe('Terms section 13, Paid Plans and Billing', () => {
  it('has the anchor the plan card links to, and a contents entry for it', () => {
    expect(TERMS_PAID_PLANS.anchor).toBe('paid-plans')
    expect(terms).toContain('<section id="paid-plans"')
    expect(terms).toContain('href="#paid-plans"')
    expect(upgrade).toContain('`/terms#${TERMS_PAID_PLANS.anchor}`')
  })

  it('numbers the sections in order, 1 to 16', () => {
    const numbers = [...terms.matchAll(/>(\d+)\. [A-Z]/g)].map((m) => Number(m[1]))
    expect(numbers).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  })

  it('covers renewal, cancelling, refunds, plan changes and failed payments', () => {
    for (const heading of [
      '13.3 Automatic renewal.',
      '13.4 Cancelling.',
      '13.5 Refunds.',
      '13.6 Changing plans.',
      '13.7 Failed payments.',
    ]) {
      expect(terms).toContain(heading)
    }
    expect(terms).toContain('Upgrade, then Manage subscription')
    expect(terms).toContain('Sections 5, 8, 9, 10, 12, and 13.')
  })

  it('has no em dashes and no leftover draft brackets', () => {
    const section = terms.slice(terms.indexOf('<section id="paid-plans"'), terms.indexOf('<section id="governing-law"'))
    expect(section).not.toMatch(/—/)
    expect(section).not.toMatch(/\[[0-9a-z ]+\]/i)
  })
})
