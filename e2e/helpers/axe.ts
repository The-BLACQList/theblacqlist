import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

/**
 * Third-party video players embedded on listing pages. Their inner markup is
 * YouTube's and Vimeo's, not ours, and we cannot change it: axe flagged a
 * button with no name and a stray aria-level inside the YouTube player. What we
 * own is the <iframe> element itself and its title, which
 * components/entity-page/EntityVideoSection.tsx sets.
 */
const THIRD_PARTY_FRAMES = 'iframe[src*="youtube"], iframe[src*="vimeo"]'

function axe(page: Page): AxeBuilder {
  return new AxeBuilder({ page }).exclude(THIRD_PARTY_FRAMES)
}

/**
 * Runs an axe-core scan on the current page and fails the test if there are any
 * Critical violations. QA tests J1–J5 require zero Critical violations only;
 * Serious violations are logged as warnings for visibility but do not fail.
 */
export async function expectNoCriticalViolations(page: Page, label: string) {
  const results = await axe(page).withTags(WCAG_TAGS).analyze()

  const critical = results.violations.filter((v) => v.impact === 'critical')
  const serious = results.violations.filter((v) => v.impact === 'serious')

  if (serious.length) {
    console.warn(
      `\n⚠️  ${label} — ${serious.length} Serious violation(s) (non-blocking):\n` +
        serious.map((v) => `   [${v.id}] ${v.help}`).join('\n')
    )
  }

  if (critical.length) {
    const report = critical
      .map(
        (v) =>
          `\n[${v.id}] ${v.help}\n  ${v.helpUrl}\n  nodes:\n` +
          v.nodes
            .map((n) => `   - ${n.target.join(' ')}\n     ${n.failureSummary}`)
            .join('\n')
      )
      .join('\n')
    console.error(`\n=== Critical a11y violations on ${label} ===${report}\n`)
  }

  expect(
    critical.map((v) => v.id),
    `Critical a11y violations on ${label}`
  ).toEqual([])
}

// axe rules that specifically cover "every form control has an accessible name"
const LABEL_RULES = [
  'label',
  'form-field-multiple-labels',
  'aria-input-field-name',
  'select-name',
  'label-title-only',
]

/**
 * Runs only axe's label/name rules on the current page and fails if any
 * form control is missing an associated <label> or accessible name (test J14).
 * Catches violations at any impact level — a missing label is always a defect.
 */
export async function expectNoLabelViolations(page: Page, label: string) {
  const results = await axe(page).withRules(LABEL_RULES).analyze()
  const violations = results.violations

  if (violations.length) {
    const report = violations
      .map(
        (v) =>
          `\n[${v.id}] ${v.help} (impact: ${v.impact})\n  ${v.helpUrl}\n  nodes:\n` +
          v.nodes.map((n) => `   - ${n.target.join(' ')}\n     ${n.failureSummary}`).join('\n')
      )
      .join('\n')
    console.error(`\n=== Label/name violations on ${label} ===${report}\n`)
  }

  expect(
    violations.map((v) => v.id),
    `Label/name violations on ${label}`
  ).toEqual([])
}

/**
 * Runs only axe's color-contrast rule on the current page and fails on any
 * violation, at any impact (ticket 098). Text under 4.5:1 is always a defect,
 * even where the broader scan rates it Serious rather than Critical.
 */
export async function expectNoContrastViolations(page: Page, label: string) {
  const results = await axe(page).withRules(['color-contrast']).analyze()
  const nodes = results.violations.flatMap((v) => v.nodes)

  if (nodes.length) {
    const report = nodes
      .map((n) => `   - ${n.target.join(' ')}\n     ${n.failureSummary}`)
      .join('\n')
    console.error(`\n=== Color contrast violations on ${label} ===\n${report}\n`)
  }

  expect(
    nodes.map((n) => n.target.join(' ')),
    `Color contrast violations on ${label}`
  ).toEqual([])
}
