import type { JobQuota, ReadResult } from '@/lib/stripe/jobPostings'
import { formatCloseDate } from '@/lib/listings/jobPosting'
import { getPlanMeta } from '@/lib/stripe/plans'

// Ticket 152, step 4: what the poster is told before they press the button. Pure
// so it can be tested. The price text is passed in (it lives in
// lib/stripe/jobPostings.ts and is never typed in a component). This is display
// only: the server re-runs the real ladder, and (ticket 273) refuses to open
// checkout unless the poster was shown a 'paid' line first.

export interface JobPriceLine {
  kind: 'included' | 'paid' | 'unknown' | 'free'
  text: string
  /** "Submit for Review", or "Pay and Submit". */
  button: string
  /** The owner's plan includes no postings at all (Free and Starter). */
  noAllowance?: boolean
}

/** Shown when the server found a charge the page hadn't mentioned. */
export const PRICE_CHECK = 'Nothing has been charged. Check the price before you submit.'

const SUBMIT = 'Submit for Review'
const PAY = 'Pay and Submit'

/** "Your next one opens Dec 3." Empty when there is no date to give. */
export function nextOpensText(nextOpensAt: string | null): string {
  const day = nextOpensAt ? formatCloseDate(nextOpensAt) : null
  return day ? `Your next one opens ${day}.` : ''
}

export function buildJobPriceLine(
  quotaRead: ReadResult<JobQuota> | null,
  priceDisplay: string,
  paidPostingsOn: boolean
): JobPriceLine {
  if (!paidPostingsOn) {
    return { kind: 'free', text: 'No charge for this posting.', button: SUBMIT }
  }
  // Never claim "included" without a successful read.
  if (!quotaRead || !quotaRead.ok) {
    return {
      kind: 'unknown',
      text: "We'll show the cost before you pay anything.",
      button: SUBMIT,
    }
  }
  const q = quotaRead.value
  const plan = q.tier === 'free' ? 'your plan' : `your ${getPlanMeta(q.tier).name} plan`
  if (!q.atLimit || q.limit === null) {
    const left = q.limit !== null && q.limit > 1 ? ` ${q.limit - q.used} of ${q.limit} postings left.` : ''
    return { kind: 'included', text: `Included with ${plan}. No charge.${left}`, button: SUBMIT }
  }
  if (q.limit > 0) {
    const spent =
      q.limit === 1
        ? `You've used the posting included with ${plan}.`
        : `You've used all ${q.limit} postings included with ${plan}.`
    const next = nextOpensText(q.nextOpensAt)
    return {
      kind: 'paid',
      text: [spent, next, `Posting now is ${priceDisplay} for 30 days.`].filter(Boolean).join(' '),
      button: PAY,
    }
  }
  return { kind: 'paid', text: `${priceDisplay} for 30 days.`, button: PAY, noAllowance: true }
}
