// =============================================================================
// The Collective's demo mode (ticket 249)
// =============================================================================
// Pins the founder's rules for the sample map: when it opens by itself, that
// it holds only made-up businesses with no links, that every business floor
// has life, and that a simulated arrival is stable for the ticker and scene.
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  DEMO_ARRIVAL,
  DEMO_SIZE,
  DEMO_UNTIL_LINKED,
  SAMPLE_BADGE,
  SAMPLE_NOTE,
  buildDemoCollective,
  demoArrivalAt,
  demoArrivalIndex,
  parseView,
  pickView,
  recentDemoArrivals,
} from '@/lib/spend/collective-demo'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import { SILO_FLOORS, siloGaps } from '@/lib/spend/silo-layout'

const thin = { realLinked: 1, hasOwnLines: false, focusYou: false }
const busy = { realLinked: DEMO_UNTIL_LINKED, hasOwnLines: false, focusYou: false }

describe('pickView', () => {
  it('opens in Demo while fewer than DEMO_UNTIL_LINKED real businesses have a line', () => {
    expect(DEMO_UNTIL_LINKED).toBe(25)
    expect(pickView(thin)).toBe('demo')
    expect(pickView({ ...thin, realLinked: DEMO_UNTIL_LINKED - 1 })).toBe('demo')
    expect(pickView(busy)).toBe('live')
  })

  it('takes ?view over the remembered choice, and the remembered choice over the count', () => {
    expect(pickView({ ...thin, param: 'live' })).toBe('live')
    expect(pickView({ ...busy, param: 'demo' })).toBe('demo')
    expect(pickView({ ...thin, param: 'live', stored: 'demo' })).toBe('live')
    expect(pickView({ ...thin, stored: 'live' })).toBe('live')
    expect(pickView({ ...busy, stored: 'demo' })).toBe('demo')
  })

  it('ignores a view it does not know', () => {
    expect(parseView('sample')).toBeNull()
    expect(parseView(undefined)).toBeNull()
    expect(pickView({ ...thin, param: 'nope', stored: 42 })).toBe('demo')
  })

  it('shows a reader their own line, which Demo never holds', () => {
    expect(pickView({ ...thin, hasOwnLines: true })).toBe('live')
    // An explicit choice still wins over own lines...
    expect(pickView({ ...thin, hasOwnLines: true, param: 'demo' })).toBe('demo')
    // ...but ?you=1 always means Live.
    expect(pickView({ ...thin, focusYou: true, param: 'demo', stored: 'demo' })).toBe('live')
  })
})

describe('buildDemoCollective', () => {
  const demo = buildDemoCollective()
  const { businesses } = demo

  it('holds about DEMO_SIZE businesses', () => {
    expect(businesses.length).toBeGreaterThan(DEMO_SIZE * 0.9)
    expect(businesses.length).toBeLessThan(DEMO_SIZE * 1.1)
  })

  it('is made-up businesses only: no links, demo ids, unique names', () => {
    expect(businesses.every((b) => b.href === null)).toBe(true)
    expect(businesses.every((b) => b.id.startsWith('demo-'))).toBe(true)
    expect(new Set(businesses.map((b) => b.name)).size).toBe(businesses.length)
  })

  it('puts life on every business floor, with lines on each', () => {
    for (let k = 1; k < SILO_FLOORS.length; k++) {
      const onFloor = businesses.filter((b) => b.floorIndex === k)
      expect(onFloor.length, SILO_FLOORS[k]!.key).toBeGreaterThan(20)
      expect(
        onFloor.some((b) => b.linked),
        SILO_FLOORS[k]!.key
      ).toBe(true)
    }
    expect(businesses.some((b) => b.floorIndex === 0)).toBe(false)
  })

  it('keeps the live rules: a line from one receipt, figures only at the total bar', () => {
    const linked = businesses.filter((b) => b.linked)
    expect(linked.length).toBeGreaterThan(businesses.length * 0.4)
    expect(linked.some((b) => !b.figuresShown)).toBe(true)
    for (const b of businesses) {
      if (!b.figuresShown) {
        expect(b.amountCents).toBe(0)
        expect(b.transactionCount).toBe(0)
      } else {
        expect(b.transactionCount).toBeGreaterThanOrEqual(AGGREGATE_MIN_TRANSACTIONS)
      }
    }
  })

  it('adds the totals up from the sample itself', () => {
    const shown = businesses.reduce((s, b) => s + b.amountCents, 0)
    expect(demo.totalSpentCents).toBeGreaterThanOrEqual(shown)
    expect(demo.receiptCount).toBeGreaterThanOrEqual(
      businesses.reduce((s, b) => s + b.transactionCount, 0)
    )
  })

  it('leaves a few gaps, so the pink squares still show', () => {
    expect(siloGaps(businesses).length).toBeGreaterThan(0)
  })

  it('is the same sample every visit', () => {
    const again = buildDemoCollective()
    expect(again.totalSpentCents).toBe(demo.totalSpentCents)
    expect(again.businesses.map((b) => `${b.id}:${b.name}`)).toEqual(
      businesses.map((b) => `${b.id}:${b.name}`)
    )
  })
})

describe('demo arrivals', () => {
  it('grows, then fades, once every few seconds', () => {
    expect(DEMO_ARRIVAL.everyMs).toBeGreaterThanOrEqual(2000)
    expect(DEMO_ARRIVAL.everyMs).toBeLessThanOrEqual(6000)
    const t0 = 1_000 * DEMO_ARRIVAL.everyMs
    const start = demoArrivalAt(t0, 100)!
    expect(start.grow).toBe(0)
    expect(start.glow).toBe(1)
    const grown = demoArrivalAt(t0 + DEMO_ARRIVAL.growMs, 100)!
    expect(grown.grow).toBe(1)
    expect(grown.glow).toBe(1)
    const late = demoArrivalAt(t0 + DEMO_ARRIVAL.everyMs - 1, 100)!
    expect(late.seq).toBe(start.seq)
    expect(late.glow).toBeLessThan(0.01)
    expect(demoArrivalAt(t0 + DEMO_ARRIVAL.everyMs, 100)!.seq).toBe(start.seq + 1)
  })

  it('lands on the same business for a given arrival, in range', () => {
    for (let seq = 0; seq < 200; seq++) {
      const i = demoArrivalIndex(seq, 37)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(37)
      expect(demoArrivalIndex(seq, 37)).toBe(i)
    }
    expect(demoArrivalAt(5_000, 0)).toBeNull()
  })

  it('gives the ticker the scene arrival first, newest to oldest', () => {
    const now = 777 * DEMO_ARRIVAL.everyMs + 10
    const a = demoArrivalAt(now, 221)!
    const recent = recentDemoArrivals(a.seq, 221, 2)
    expect(recent).toEqual([a.index, demoArrivalIndex(a.seq - 1, 221)])
  })

  it('labels the sample plainly', () => {
    expect(SAMPLE_BADGE).toBe('Sample Data')
    expect(SAMPLE_NOTE).toBe('Not real businesses or spending.')
  })
})
