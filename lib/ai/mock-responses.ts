/**
 * Mock provider output — deterministic, offline, and made only of the listing's
 * own real values.
 *
 * ── Why the mock is real copy and not lorem ipsum ────────────────────────────
 * The point of the V2 Mock phase (`docs/blacqlist/ai/ai-agent-roadmap.md`) is to
 * exercise the approval workflow end to end before a provider is ever billed:
 * request → pending → approve → apply → the listing field actually changes. A
 * placeholder string cannot do that honestly. An owner asked to approve
 * "Lorem ipsum" is not reviewing anything, so the review step gets clicked
 * through and gate 1 gets marked cleared on a test that never tested the
 * judgement it exists to protect.
 *
 * So every string below is assembled from the business's real name, category and
 * city, and is copy the owner could legitimately keep. Applying it does no harm
 * because it is true.
 *
 * ── The marker goes in the UI, not in the text ───────────────────────────────
 * It is tempting to stamp "[sample]" into the suggestion so nobody mistakes it
 * for a real generation. That marker would then be applied to `meta_title` and
 * published. Provenance belongs where provenance belongs: the audit row records
 * `provider = 'mock'`, and the owner-facing surface renders that as a "Sample"
 * badge next to the suggestion. The content stays clean.
 *
 * ── Deterministic on purpose ─────────────────────────────────────────────────
 * Same input, same output, every time. No randomness and no clock: a test that
 * asserts on generated text has to be able to assert on it, and a mock that
 * varies would make the difference between "the pipeline changed" and "the mock
 * rolled differently" impossible to see in CI.
 */

import type { AgentDefinition } from './agents'

export interface MockContext {
  listingName: string
  categoryName: string
  cityName: string
  tagline: string | null
  descriptionExcerpt: string
  pageViews30d: number
  ctaClicks30d: number
  saves30d: number
}

/** Trims a title to a search-safe length without cutting a word in half. */
function clampTitle(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()
}

export function mockResponseFor(agent: AgentDefinition, ctx: MockContext): string {
  const { listingName, categoryName, cityName } = ctx

  switch (agent.agentType) {
    case 'seo_coach_title':
      // Under 60 characters is the whole requirement of the real prompt, so the
      // mock has to honour it or the mock passes checks the real thing will fail.
      return clampTitle(`${listingName} — ${categoryName} in ${cityName}`, 60)

    case 'seo_coach_description':
      return clampTitle(
        `Discover ${listingName}, a Black-owned ${categoryName.toLowerCase()} business in ${cityName}. See hours, services and reviews, then reach out.`,
        160
      )

    case 'listing_description': {
      const opener = ctx.tagline
        ? `${listingName} — ${ctx.tagline}.`
        : `${listingName} is a ${categoryName.toLowerCase()} business serving ${cityName}.`
      return [
        opener,
        ``,
        `Rooted in ${cityName}, ${listingName} works with neighbours, regulars and first-time visitors alike. The focus is straightforward: do the work well, treat people properly, and be somewhere the community is glad exists.`,
        ``,
        `If you are looking for ${categoryName.toLowerCase()} in ${cityName} and you would rather your money stayed close to home, this is a good place to start. Reach out and say what you need — you will get a real answer from a real person.`,
      ].join('\n')
    }

    case 'social_caption_instagram': {
      const hook = ctx.tagline ? ctx.tagline : `${categoryName} in ${cityName}, done right`
      const tag = cityName.replace(/[^A-Za-z]/g, '')
      return `${hook}. Find us on The BLACQList and come see us.\n\n#BlackOwned #${tag} #SupportBlackBusiness #ShopLocal`
    }

    case 'analytics_explainer': {
      // Reads whatever the real counts are. A mock that invents traffic numbers
      // would be a fabricated metric on an owner-facing surface — see
      // .claude/rules/no-fabrication.md. These are the measured values, passed in.
      const strongest =
        ctx.pageViews30d >= ctx.saves30d && ctx.pageViews30d >= ctx.ctaClicks30d
          ? `${ctx.pageViews30d} page views`
          : ctx.saves30d >= ctx.ctaClicks30d
            ? `${ctx.saves30d} saves`
            : `${ctx.ctaClicks30d} contact clicks`
      const weakest =
        ctx.ctaClicks30d <= ctx.saves30d
          ? 'Your contact clicks are the quietest number here — a clearer call to action and a current phone or booking link usually move it first.'
          : 'Saves are the quietest number here — a strong cover photo is what makes someone keep you for later.'
      return `Over the last 30 days your strongest signal was ${strongest}. ${weakest}`
    }

    default:
      // A new agent added to the registry without a mock lands here. Returning
      // empty makes validateOutput reject it as 'empty', which fails the
      // generation loudly instead of shipping a blank suggestion.
      return ''
  }
}
