import type { JobQuota, ReadResult } from '@/lib/stripe/jobPostings'

// Ticket 152, step 4: what the poster is told before they press the button. Pure
// so it can be tested. The price text is passed in (it lives in
// lib/stripe/jobPostings.ts and is never typed in a component). This is display
// only: postJobAction re-runs the real ladder on the server.

export interface JobPriceLine {
  kind: 'included' | 'paid' | 'unknown' | 'free'
  text: string
  /** "Submit for review", or "Pay and submit". */
  button: string
}

export function buildJobPriceLine(
  quotaRead: ReadResult<JobQuota> | null,
  priceDisplay: string,
  paidPostingsOn: boolean
): JobPriceLine {
  if (!paidPostingsOn) {
    return { kind: 'free', text: 'No charge for this posting.', button: 'Submit for review' }
  }
  // Never claim "included" without a successful read.
  if (!quotaRead || !quotaRead.ok) {
    return {
      kind: 'unknown',
      text: "We'll show the cost after you submit.",
      button: 'Submit for review',
    }
  }
  const q = quotaRead.value
  if (q.limit === null) {
    return { kind: 'included', text: 'Included with your plan.', button: 'Submit for review' }
  }
  if (!q.atLimit) {
    return {
      kind: 'included',
      text: `Uses 1 of your ${q.limit} included postings (${q.used} used)`,
      button: 'Submit for review',
    }
  }
  if (q.limit > 0) {
    return {
      kind: 'paid',
      text: `You've used all ${q.limit} included postings. This one is ${priceDisplay} for 30 days.`,
      button: 'Pay and submit',
    }
  }
  return { kind: 'paid', text: `${priceDisplay} for 30 days.`, button: 'Pay and submit' }
}
