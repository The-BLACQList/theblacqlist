import { formatCloseDate } from '@/lib/listings/jobPosting'

// Ticket 153: everything the "Your role is in review" page says, as a pure
// function of what the server read. The page reads; this decides the words.

export type ConfirmationListingStatus = 'draft' | 'pending' | 'published' | 'rejected' | string

export interface LedgerRow {
  source: 'stripe' | 'entitlement' | string
  status: string
  amount_cents: number | null
  paid_at: string | null
}

export interface ConfirmationInput {
  status: ConfirmationListingStatus
  /** Newest paid ledger row, or null when none exists. */
  ledger: LedgerRow | null
  /** True when the ledger read itself failed (distinct from "no row"). */
  ledgerFailed: boolean
  /** True when the poster came back from Stripe (`?paid=1`). A hint only, never proof. */
  returnedFromCheckout: boolean
  /** Plan name for an included posting, e.g. "Growth". */
  tierName: string | null
  submittedAt: string | null
  closesAt: string | null
  rejectionReason: string | null
  /** Price shown when the ledger row carries no amount. */
  fallbackPrice: string
}

export type StepState = 'done' | 'current' | 'upcoming'

export interface TimelineStep {
  label: string
  detail: string
  state: StepState
  /** Visible text for the state, so it never relies on color alone. */
  stateText: string
}

export type ConfirmationModel =
  | {
      kind: 'review' | 'live'
      heading: string
      costLine: string
      timeline: TimelineStep[]
    }
  | { kind: 'confirming'; heading: string }
  | { kind: 'rejected'; heading: string; reason: string }
  | { kind: 'redirect' }

const STATE_TEXT: Record<StepState, string> = {
  done: 'Done',
  current: 'Now',
  upcoming: 'Up next',
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function costLine(input: Pick<ConfirmationInput, 'ledger' | 'ledgerFailed' | 'tierName' | 'fallbackPrice'>): string {
  if (input.ledgerFailed) return "We couldn't load the cost just now."
  const row = input.ledger
  if (!row) return 'No charge.'
  if (row.source === 'entitlement') {
    return input.tierName
      ? `Included with your ${input.tierName} plan. No charge.`
      : 'Included with your plan. No charge.'
  }
  const amount = row.amount_cents && row.amount_cents > 0 ? formatCents(row.amount_cents) : input.fallbackPrice
  return `You paid ${amount} for 30 days.`
}

function step(label: string, detail: string, state: StepState): TimelineStep {
  return { label, detail, state, stateText: STATE_TEXT[state] }
}

export function buildTimeline(
  input: Pick<ConfirmationInput, 'submittedAt' | 'closesAt'>,
  live: boolean
): TimelineStep[] {
  const submitted = input.submittedAt ? formatCloseDate(input.submittedAt, 'long') : null
  const closes = input.closesAt ? formatCloseDate(input.closesAt, 'long') : null
  return [
    step('Submitted', submitted ?? 'Received', 'done'),
    step('In review', live ? 'Approved by our team' : 'Usually 3 to 5 business days', live ? 'done' : 'current'),
    step('Live', live ? 'Your role is on the board' : 'After our team approves it', live ? 'current' : 'upcoming'),
    step('Closes', closes ?? '30 days after it goes live', 'upcoming'),
  ]
}

export function buildConfirmationModel(input: ConfirmationInput): ConfirmationModel {
  switch (input.status) {
    case 'pending':
      return {
        kind: 'review',
        heading: 'Your role is in review',
        costLine: costLine(input),
        timeline: buildTimeline(input, false),
      }
    case 'published':
      return {
        kind: 'live',
        heading: 'Your role is live',
        costLine: costLine(input),
        timeline: buildTimeline(input, true),
      }
    case 'rejected':
      return {
        kind: 'rejected',
        heading: 'This role needs changes',
        reason: input.rejectionReason?.trim() || 'Our team left no note. Open the editor to review your role.',
      }
    case 'draft':
      // Only a poster who just came back from Stripe, or one whose payment is
      // already on the ledger, is waiting on the webhook. Anyone else holds a
      // draft that was never submitted and belongs in the editor.
      if (input.returnedFromCheckout || input.ledger) {
        return { kind: 'confirming', heading: "We're confirming your payment" }
      }
      return { kind: 'redirect' }
    default:
      return { kind: 'redirect' }
  }
}

/** The part of the moderation note the poster should see (admin-only notes stay private). */
export function publicRejectionReason(notes: string | null | undefined): string | null {
  if (!notes) return null
  const head = notes.split('\n\nAdmin notes:')[0]?.trim()
  return head || null
}

/** Poll every 5 seconds, up to 30 seconds, then give the slower message. */
export const POLL_INTERVAL_MS = 5000
export const POLL_MAX_TICKS = 6
