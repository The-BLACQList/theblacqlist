import { describe, it, expect } from 'vitest'
import {
  effectiveSponsoredStatus,
  isCancelable,
  SPONSORED_STATUS_LABEL,
  type SponsoredLifecycleRow,
} from '@/lib/listings/sponsoredStatus'

// The defect this module exists to fix: a placement's status is written once at
// creation (lib/actions/admin/createSponsoredPlacement.ts:43) and nothing in the
// codebase ever moves it on — there is no expiry job, no activation job, no cron.
// So the stored value drifts away from the truth the moment a date passes, in
// BOTH directions. These tests pin the derived answer against the dates.

const NOW = new Date('2026-08-15T12:00:00Z')
const PAST = '2026-08-01T00:00:00Z'
const FURTHER_PAST = '2026-07-01T00:00:00Z'
const FUTURE = '2026-09-01T00:00:00Z'
const FURTHER_FUTURE = '2026-10-01T00:00:00Z'

function row(partial: Partial<SponsoredLifecycleRow>): SponsoredLifecycleRow {
  return { status: 'active', starts_at: PAST, ends_at: FUTURE, ...partial }
}

describe('effectiveSponsoredStatus', () => {
  it('reports a placement inside its window as active', () => {
    expect(effectiveSponsoredStatus(row({}), NOW)).toBe('active')
  })

  it('reports an ended placement as expired even though the row still says active', () => {
    // This is the bug the admin table showed for months: ends_at long past,
    // status still 'active', delivery long since stopped.
    const stale = row({ status: 'active', starts_at: FURTHER_PAST, ends_at: PAST })
    expect(stale.status).toBe('active')
    expect(effectiveSponsoredStatus(stale, NOW)).toBe('expired')
  })

  it('reports a future placement as scheduled', () => {
    expect(
      effectiveSponsoredStatus(row({ status: 'scheduled', starts_at: FUTURE, ends_at: FURTHER_FUTURE }), NOW)
    ).toBe('scheduled')
  })

  it('reports a scheduled placement whose start date has passed as active', () => {
    // The mirror-image defect: nothing promotes 'scheduled' to 'active', so a
    // placement booked in advance kept reporting "Scheduled" after it began.
    const started = row({ status: 'scheduled', starts_at: PAST, ends_at: FUTURE })
    expect(started.status).toBe('scheduled')
    expect(effectiveSponsoredStatus(started, NOW)).toBe('active')
  })

  it('lets canceled outrank the dates, in or out of window', () => {
    expect(effectiveSponsoredStatus(row({ status: 'canceled' }), NOW)).toBe('canceled')
    expect(
      effectiveSponsoredStatus(
        row({ status: 'canceled', starts_at: FUTURE, ends_at: FURTHER_FUTURE }),
        NOW
      )
    ).toBe('canceled')
  })

  it('lets inactive outrank the dates', () => {
    expect(effectiveSponsoredStatus(row({ status: 'inactive' }), NOW)).toBe('inactive')
  })

  it('treats a canceled placement that also ended as canceled, not expired', () => {
    // Why it matters: "canceled" records that someone made a decision. Collapsing
    // it into "expired" once the date passes would erase that from the record and
    // make an early cancellation indistinguishable from a full run.
    expect(
      effectiveSponsoredStatus(
        { status: 'canceled', starts_at: FURTHER_PAST, ends_at: PAST },
        NOW
      )
    ).toBe('canceled')
  })

  it('treats the end boundary as exclusive and the start boundary as inclusive', () => {
    // Matches the delivery query's `.lte(starts_at, now).gt(ends_at, now)` in
    // lib/listings/query.ts — the two surfaces must not disagree at the edges.
    const boundary = '2026-08-15T12:00:00Z'
    expect(effectiveSponsoredStatus(row({ ends_at: boundary }), NOW)).toBe('expired')
    expect(effectiveSponsoredStatus(row({ starts_at: boundary }), NOW)).toBe('active')
  })

  it('does not invent a window from null dates', () => {
    // An open-ended row is whatever its stored status says; nulls are not an
    // excuse to guess.
    expect(effectiveSponsoredStatus({ status: 'active', starts_at: null, ends_at: null }, NOW)).toBe(
      'active'
    )
    expect(
      effectiveSponsoredStatus({ status: 'inactive', starts_at: null, ends_at: null }, NOW)
    ).toBe('inactive')
  })

  it('falls back to inactive for a status it does not recognize', () => {
    expect(effectiveSponsoredStatus(row({ status: 'something_new' }), NOW)).toBe('inactive')
  })

  it('defaults `now` to the real clock', () => {
    // Guards the signature: a caller that forgets the second argument must still
    // get a date-aware answer, not a crash or a stored-status passthrough.
    expect(
      effectiveSponsoredStatus({ status: 'active', starts_at: FURTHER_PAST, ends_at: PAST })
    ).toBe('expired')
  })
})

describe('isCancelable', () => {
  it('allows cancelling only what is still delivering or still to come', () => {
    expect(isCancelable('active')).toBe(true)
    expect(isCancelable('scheduled')).toBe(true)
  })

  it('refuses to cancel what has already stopped', () => {
    expect(isCancelable('expired')).toBe(false)
    expect(isCancelable('canceled')).toBe(false)
    expect(isCancelable('inactive')).toBe(false)
  })
})

describe('SPONSORED_STATUS_LABEL', () => {
  it('has a label for every status the derivation can return', () => {
    // Exhaustive by construction — a new status added to the union without a
    // label would fail typecheck, and this pins the runtime side too.
    for (const s of ['active', 'scheduled', 'expired', 'canceled', 'inactive'] as const) {
      expect(SPONSORED_STATUS_LABEL[s]).toBeTruthy()
    }
  })
})
