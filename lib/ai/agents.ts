/**
 * The agent registry — the single place that says what an AI agent is allowed to
 * write, which prompt it uses, and how much model it deserves.
 *
 * ── Why a registry and not a switch ─────────────────────────────────────────
 * Three separate things have to agree for a suggestion to be safe: the prompt
 * template it was generated from, the `suggestion_type` CHECK value the database
 * will accept, and the listing field it is eventually allowed to overwrite. When
 * those three live in three different files they drift, and the failure mode is
 * a suggestion generated from the SEO-title prompt being applied to the business
 * description. Here they are one row and cannot disagree.
 *
 * ── Not every suggestion is applicable ──────────────────────────────────────
 * `applyTarget: null` is a deliberate value, not a gap. A social caption has no
 * listing field to become — it is copy the owner takes elsewhere. An analytics
 * summary is a reading of data, not content. `applySuggestion` refuses those
 * types rather than guessing a destination, so a future agent added without an
 * apply target fails closed instead of writing somewhere plausible.
 *
 * ── The model is chosen in one place ────────────────────────────────────────
 * Each agent declares a `modelTier`, how much quality the task needs. The tier
 * maps to a model id in `MODEL_BY_TIER` below, so changing models is a one-line
 * edit that the spending ceiling's price table (`spend.ts`) has to follow.
 */

import { AGENT_PROMPT_MAP, type PromptTemplateKey } from './prompts'

/** How much model the task needs. Mapped to a model id in `MODEL_BY_TIER`. */
export type ModelTier = 'fast' | 'quality'

/** A listing field a suggestion may be applied to, or null for copy-only output. */
export type ApplyTarget =
  | { table: 'listings'; column: 'meta_title' | 'meta_description' }
  | { table: 'listing_details_business'; column: 'description' }
  | null

export interface AgentDefinition {
  /** Stable key. Written to `ai_generation_requests.agent_type`. */
  agentType: string
  /** Prompt template. Must exist in AGENT_PROMPT_MAP. */
  templateKey: PromptTemplateKey
  /** Must be one of the `ai_suggestions.suggestion_type` CHECK values. */
  suggestionType: string
  /** Owner-facing name. */
  label: string
  /** One line the owner reads before spending a request on it. */
  blurb: string
  modelTier: ModelTier
  applyTarget: ApplyTarget
  /** Hard ceiling on accepted output, in characters. */
  maxOutputChars: number
}

/**
 * The agents active in mock mode, in the order they are offered to an owner.
 *
 * This is five of the thirteen agents in `docs/blacqlist/ai/ai-agent-roadmap.md`,
 * matching that document's V2 Mock set. The other eight are not disabled — they
 * are not built. Adding one means adding a row here, a mock response, and a test;
 * it does not mean touching the provider.
 */
export const AI_AGENTS: readonly AgentDefinition[] = [
  {
    agentType: 'seo_coach_title',
    templateKey: 'SEO_TITLE',
    suggestionType: 'seo_title',
    label: 'SEO title',
    blurb: 'A search-friendly page title under 60 characters.',
    modelTier: 'fast',
    applyTarget: { table: 'listings', column: 'meta_title' },
    maxOutputChars: 120,
  },
  {
    agentType: 'seo_coach_description',
    templateKey: 'SEO_DESCRIPTION',
    suggestionType: 'seo_description',
    label: 'SEO description',
    blurb: 'The 140–160 character summary search engines show under your title.',
    modelTier: 'fast',
    applyTarget: { table: 'listings', column: 'meta_description' },
    maxOutputChars: 320,
  },
  {
    agentType: 'listing_description',
    templateKey: 'LISTING_DESCRIPTION',
    suggestionType: 'listing_description',
    label: 'Business description',
    blurb: 'A 150–250 word description of what you do and why to come to you.',
    modelTier: 'quality',
    applyTarget: { table: 'listing_details_business', column: 'description' },
    maxOutputChars: 2000,
  },
  {
    agentType: 'social_caption_instagram',
    templateKey: 'SOCIAL_CAPTION_INSTAGRAM',
    suggestionType: 'social_caption',
    label: 'Instagram caption',
    blurb: 'A caption for sharing your page, with hashtags. Copy it out to post.',
    modelTier: 'fast',
    // Copy-only: there is no listing field that is "your Instagram caption".
    applyTarget: null,
    maxOutputChars: 600,
  },
  {
    agentType: 'analytics_explainer',
    templateKey: 'ANALYTICS_SUMMARY',
    suggestionType: 'analytics_summary',
    label: 'Analytics summary',
    blurb: 'Plain-language read on your last 30 days, and one thing to try next.',
    modelTier: 'quality',
    // A reading of your own data. Nothing to apply.
    applyTarget: null,
    maxOutputChars: 800,
  },
] as const

export function findAgent(agentType: string): AgentDefinition | undefined {
  return AI_AGENTS.find((a) => a.agentType === agentType)
}

/**
 * Tier → model id. Founder decision at GATE-SPEND, 2026-10-15: Claude Haiku 5.5
 * for every tier. These are short, tightly specified copy tasks, and Haiku 5.5
 * handles them at a tenth of a cent or less per call.
 *
 * A model id here is not enough to start spending. `resolveProvider` also needs
 * `ANTHROPIC_API_KEY` and `AI_MONTHLY_CEILING_USD`; without both it runs the
 * mock. If you change a model, update `PRICE_PER_MTOK` in spend.ts with it.
 */
export const MODEL_BY_TIER: Record<ModelTier, string | null> = {
  fast: 'claude-haiku-5-5',
  quality: 'claude-haiku-5-5',
}

/** The model label written to the audit row when no real provider ran. */
export const MOCK_MODEL = 'mock-v1'

/**
 * Written to `ai_generation_requests.prompt_version`. @2 (2026-10-15): neutral
 * ownership wording and the shared system prompt.
 */
export function promptVersionOf(agent: AgentDefinition): string {
  return `${agent.templateKey}@2`
}

// Fails the build (via the test suite) if an agent names a template that the
// prompt map does not route. The map is the contract prompts.ts documents.
export function agentsWithUnroutedTemplates(): string[] {
  return AI_AGENTS.filter((a) => AGENT_PROMPT_MAP[a.agentType] !== a.templateKey).map(
    (a) => a.agentType
  )
}
