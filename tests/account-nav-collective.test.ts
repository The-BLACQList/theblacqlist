import { describe, it, expect } from 'vitest'
import { collectiveItems } from '@/components/account/AccountNav'

// H4 (simplicity pass, 2026-10-15): the three Collective-flag rows collapse into
// one "Soon" row while covered, and come back individually once it opens.
describe('collectiveItems', () => {
  it('collapses to one Soon row while the Collective is covered', () => {
    expect(collectiveItems(4, true)).toEqual([
      { href: '/account/community-spend', label: 'The Collective', soon: true },
    ])
  })

  it('shows Receipts, My spending and The Collective once it is open', () => {
    const items = collectiveItems(4, false)
    expect(items.map((i) => i.label)).toEqual(['Receipts', 'My spending', 'The Collective'])
    expect(items.some((i) => i.soon)).toBe(false)
    expect(items[0]?.count).toBe(4)
  })
})
