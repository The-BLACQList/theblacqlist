// =============================================================================
// Community-spend vocabulary
// =============================================================================
// The product publishes a one-hop sum: one approved receipt, counted once,
// consumer -> business. Nothing follows the dollar after that.
//
// It used to publish that sum under the word "circulated" on four surfaces.
// "Circulation" is an economics term for multi-hop velocity — a dollar counted
// again on each hand it passes through — and the schema cannot express a second
// hop even in principle: flow_nodes.node_type CHECKs to 'business' | 'city', so
// business -> city is the only edge that exists. There is no business-to-
// business data to accumulate.
//
// `[Decision — founder, 2026-08-16]` Figures are labeled for what they measure.
// "Circulation" stays mission language in the vision, PRD, pitch and partner
// materials; it never labels a number.
//
// This file guards the labels by parsing source, because vitest runs
// environment: 'node' with no jsdom and these are Server Components that cannot
// be rendered here — the same technique tests/aggregate-privacy.test.ts uses.
//
// Non-vacuity: every assertion below failed against the pre-change source. The
// strings it forbids were all present on 9e55a8e.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

// The surfaces that render a community-spend figure with a label attached.
const FIGURE_SURFACES = [
  'app/(public)/flow-map/page.tsx',
  'components/flow-map/FlowSummaryCards.tsx',
  'components/home/ImpactBand.tsx',
] as const

describe('community-spend vocabulary', () => {
  it('no surface that renders a figure labels it "circulated"', () => {
    for (const file of FIGURE_SURFACES) {
      const source = read(file)

      // Strip comments before asserting. The explanatory comments in these
      // files necessarily contain the word — that is the point of them, and a
      // guard that forbade the explanation would delete its own rationale.
      const withoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')

      expect(withoutComments, `${file} must not label a figure "circulated"`).not.toMatch(
        /circulat/i
      )
    }
  })

  it('labels the flow-map figure for the one hop it measures', () => {
    const source = read('app/(public)/flow-map/page.tsx')
    expect(source).toContain('spent with Black-owned businesses')
  })

  it('does not call admin-approved receipts "verified"', () => {
    // An admin reviewed a receipt. Nothing reconciled it against a payment
    // processor, so "verified" claims a check that never happened.
    const source = read('components/flow-map/FlowSummaryCards.tsx')
    expect(source).not.toMatch(/Verified (community spend|receipts)/)
    expect(source).toContain('Reported community spend')
  })
})

// Deliberately NOT asserted here: that the methodology doc carries the
// definition these labels depend on. That doc lands in its own PR, and a guard
// referencing it would make these two PRs order-dependent — the copy PR would
// fail CI whenever it merged first. The doc's own suite guards the doc.
