// =============================================================================
// Only businesses on The BLACQList count (ticket 183)
// =============================================================================
// Pinned here:
//   * an unmatched receipt waits UNLISTED_WAIT_DAYS for the business to join,
//     then stops waiting; a matched or reviewed receipt is never "waiting";
//   * every public reader of spend_events leaves out unmatched spend, past
//     and future, alongside the opt-out filter;
//   * the receipt form only sends a listed business's receipt to the post.
// =============================================================================

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { UNLISTED_WAIT_DAYS, unlistedWait, unlistedWaitLine } from '@/lib/spend/unlisted'

const now = new Date('2026-11-13T12:00:00Z')
const day = 24 * 60 * 60 * 1000
const ago = (d: number) => new Date(now.getTime() - d * day).toISOString()

describe('unlistedWait', () => {
  it('waits for the business up to the limit, then stops', () => {
    const r = { listing_id: null, status: 'pending_review' }
    expect(unlistedWait({ ...r, created_at: ago(0) }, now)).toBe('waiting')
    expect(unlistedWait({ ...r, created_at: ago(UNLISTED_WAIT_DAYS - 0.01) }, now)).toBe('waiting')
    expect(unlistedWait({ ...r, created_at: ago(UNLISTED_WAIT_DAYS) }, now)).toBe('stopped')
  })

  it('is null for a matched receipt or one already reviewed', () => {
    expect(
      unlistedWait({ listing_id: 'l1', status: 'pending_review', created_at: ago(200) }, now)
    ).toBeNull()
    for (const status of ['approved', 'rejected']) {
      expect(unlistedWait({ listing_id: null, status, created_at: ago(1) }, now)).toBeNull()
    }
  })

  it('tells the shopper how to get it counted, then that it was not', () => {
    expect(unlistedWaitLine('waiting', 'Corner Books')).toMatch(
      /only count for businesses on The BLACQList/
    )
    expect(unlistedWaitLine('waiting', 'Corner Books')).toMatch(/edit this receipt and pick them/)
    expect(unlistedWaitLine('stopped', 'Corner Books')).toMatch(/^Not counted\. Corner Books/)
  })
})

const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

const PUBLIC_READERS = [
  'app/page.tsx',
  'app/(public)/flow-map/page.tsx',
  'app/api/community-spend/route.ts',
  'app/api/flow-map/summary/route.ts',
  'app/account/community-spend/page.tsx',
]

describe('public totals', () => {
  it.each(PUBLIC_READERS)('%s leaves out spend from businesses not on The BLACQList', (file) => {
    const src = read(file)
    const reads = src.split(".from('spend_events')").slice(1)
    expect(reads.length).toBeGreaterThan(0)
    for (const chain of reads) {
      const head = chain.slice(0, 400)
      expect(head).toContain(".eq('aggregate_opt_out', false)")
      expect(head).toContain(".not('listing_id', 'is', null)")
    }
  })

  it('covers every app reader of spend_events', () => {
    // A new public reader must join PUBLIC_READERS. The writer isn't one.
    const NOT_PUBLIC = ['lib/spend/applyReceiptReview.ts']
    const found = execSync('grep -rl "from(\'spend_events\')" app lib components', { cwd: ROOT })
      .toString()
      .trim()
      .split('\n')
      .filter((f) => !f.startsWith('lib/supabase/types'))
      .sort()
    expect(found).toEqual([...PUBLIC_READERS, ...NOT_PUBLIC].sort())
  })
})

describe('the receipt form', () => {
  it('sends only a listed business to the support post', () => {
    const src = read('components/spend/ReceiptSubmissionForm.tsx')
    expect(src).toMatch(/state\.id && state\.matched\s*\?\s*supportShareHref/)
    expect(read('lib/actions/spend/createReceiptSubmission.ts')).toContain(
      'matched: listingId !== null'
    )
  })
})
