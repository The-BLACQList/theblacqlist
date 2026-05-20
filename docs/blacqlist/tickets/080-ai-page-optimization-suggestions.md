# Ticket 080: AI Page Optimization Suggestions

## Status

Draft

## Phase

Phase 15: AI Assistant Foundations

## Priority

P3

## Feature Area

AI

## Context

Business owners see AI-generated suggestions for improving their BLACQList Page quality on the owner dashboard. The SA reads the listing's current data, constructs a structured prompt, calls the Claude API, and returns 3–5 specific, actionable suggestions. Results are cached per listing for 24h. Behind the `AI_FEATURES_ENABLED` feature flag — if disabled, the suggestions section is hidden entirely. Prompt template stored in `lib/ai/prompts/page-optimization.ts`.

## User Story

As a business owner, I want AI-powered suggestions for improving my BLACQList Page, so that I can increase my visibility in search and make my page more compelling to visitors without needing to guess what to improve.

## Scope

- SA: `getPageOptimizationSuggestions(listingId: string): Promise<ActionResult<PageOptimizationSuggestions>>`
- Reads: `listings`, `listing_details_business`, `listing_hours`, `listing_links`, `services`, `media_attachments` for the listing
- Constructs prompt with listing completeness data and calls `callClaude()` from Ticket 079
- Returns array of `{ category: string, message: string, priority: 'high'|'medium'|'low', action_link?: string }`
- Cached with `unstable_cache` — tag `ai-suggestions-${listingId}`, revalidate 86400 (24h)
- `revalidateTag(\`ai-suggestions-${listingId}\`)`called when listing data changes (add to`updateListingDraft` SA)
- Dashboard UI: dismissable inline tip cards below the completion checklist on `/dashboard/page`
- Dismissed suggestions stored in `localStorage` (client-side only — reappear on next day's cache refresh)
- Feature flag check: if `!isAIEnabled()`, the UI section is not rendered and the SA is not called
- Prompt template: `lib/ai/prompts/page-optimization.ts` — system prompt + user prompt construction function

## Out of Scope

- AI suggestions for search ranking (V3)
- Suggestion history or tracking which suggestions were acted on
- Suggestions pushed via email or notifications

## Dependencies

- Depends on: Ticket 079 (Anthropic client infrastructure)
- Depends on: Ticket 050 (owner dashboard — the UI integration point)

## UX Notes

- Route: `/dashboard/page` (integrated into the page editor)
- Loading: skeleton — 2 tip card skeletons shown while fetching
- Empty: if AI returns no suggestions (listing is already complete), show "Your page looks great! Keep it updated." — hidden if flag is off
- Error: silently hide the suggestions section if the AI call fails (graceful degradation)
- Success: 3–5 dismissable tip cards, each with a category icon, message, priority badge, and optional "Fix this →" link to the relevant editor section

## Design Notes

- Tip cards: `bg-card border-l-4` with border color matching priority (Amber Gold for high, Charcoal for medium, Pale Lavender for low)
- Dismiss button: `×` icon, `ghost` variant, removes card from view (localStorage)
- "Fix this →" link: Amber Gold text, navigates to the relevant section of the page editor
- Section header: "AI Suggestions" with a small ✦ icon (or similar — not an emoji unless designed)
- Hidden entirely when feature flag is off — no "AI coming soon" placeholder

## Data Notes

- No new tables — reads from existing listing tables
- `action_link` in response maps to dashboard routes: e.g., `'/dashboard/page#about'`, `'/dashboard/services'`
- Prompt input data: `{ name, description, listing_type, category, city, has_cover_image, has_logo, gallery_count, services_count, hours_set, links_count, primary_cta_type, word_count_description }`

## API Notes

- SA: `getPageOptimizationSuggestions` in `lib/actions/ai.ts`
- Returns: `ActionResult<{ suggestions: Array<{ category, message, priority, action_link? }> }>`
- If `isAIEnabled()` is false: returns `{ error: 'AI features are disabled', code: 'AI_DISABLED' }` — caller hides the section
- Prompt file: `lib/ai/prompts/page-optimization.ts`

## Implementation Notes

```typescript
// lib/ai/prompts/page-optimization.ts
export const PAGE_OPTIMIZATION_SYSTEM = `You are a helpful advisor for Black-owned business owners using The BLACQList platform. 
Analyze the provided listing data and return 3-5 specific, actionable suggestions to improve the listing's quality and visibility.
Return JSON only: { suggestions: [{ category: string, message: string, priority: "high"|"medium"|"low", action_link?: string }] }`

export function buildPageOptimizationPrompt(data: ListingQualityData): string {
  return `Listing: "${data.name}" (${data.listing_type} in ${data.city}, category: ${data.category})
Description word count: ${data.word_count_description}
Has cover image: ${data.has_cover_image}, has logo: ${data.has_logo}
Gallery images: ${data.gallery_count}, services listed: ${data.services_count}
Hours configured: ${data.hours_set}, social/website links: ${data.links_count}
Primary CTA: ${data.primary_cta_type || 'none'}

Provide 3-5 suggestions to improve this listing. Focus on what will most increase visitor trust and conversion.`
}
```

- Dashboard component: `components/dashboard/ai-suggestions.tsx` — `'use client'` (for localStorage dismiss)
- Fetch the suggestions via SA called from a Server Component, pass results as props to the client component

## Acceptance Criteria

- [ ] Given a listing with a short description (< 50 words), the suggestions include a message about description length
- [ ] Given a listing missing a cover image, the suggestions include a cover image recommendation
- [ ] Suggestions render as dismissable tip cards on `/dashboard/page`
- [ ] Dismissed suggestions are removed from view and do not reappear on the same session
- [ ] When `AI_FEATURES_ENABLED=false`, the suggestions section is not rendered at all
- [ ] When the AI call fails, the suggestions section is silently hidden — no error shown to the user
- [ ] Suggestions are cached for 24h — the SA is not called on every page load
- [ ] `revalidateTag('ai-suggestions-[id]')` is called when listing data is updated

## Failure States

| Failure                   | User-visible behavior                                            |
| ------------------------- | ---------------------------------------------------------------- |
| AI feature flag off       | Suggestions section not rendered — no indication to user         |
| Claude API timeout        | Suggestions section silently hidden — page editor works normally |
| Claude API rate limit     | Same as timeout — graceful degradation                           |
| AI returns malformed JSON | SA returns error; suggestions section silently hidden            |

## Edge Cases

- Listing is fully complete (all fields filled) — AI may return "Your page looks great!" — display the positive message
- Listing was just created with no data — AI should not be called until at least name, category, and city are set
- Owner dismisses all suggestions — empty suggestions area hidden; no empty state shown

## Accessibility Notes

- [ ] Tip card dismiss button has `aria-label="Dismiss suggestion"`
- [ ] "Fix this →" links are descriptive: `aria-label="Fix: [suggestion category]"`
- [ ] Section heading "AI Suggestions" is an `<h2>` or appropriate heading level
- [ ] Color priority indicators have text labels alongside (not color alone)

## QA Test Cases

| #   | Scenario                       | Role  | Steps                                          | Expected result                                           |
| --- | ------------------------------ | ----- | ---------------------------------------------- | --------------------------------------------------------- |
| 1   | AI enabled, incomplete listing | Owner | Open /dashboard/page with short description    | 3+ suggestions render including description tip           |
| 2   | Feature flag off               | Owner | Set AI flag off, open /dashboard/page          | Suggestions section not visible                           |
| 3   | Dismiss suggestion             | Owner | Click × on a tip card                          | Card removed from view; does not reappear in same session |
| 4   | AI call fails                  | Owner | Force AI timeout (test environment), open page | Page editor works; suggestions section silently absent    |
| 5   | "Fix this" link                | Owner | Click "Fix this →" on a suggestion             | Navigates to correct section of page editor               |

## Security Notes

- `ANTHROPIC_API_KEY` never leaves the server
- Listing data sent to Claude is non-PII (business metadata, not owner personal data)
- SA enforces `listings.owner_user_id = auth.uid()` before fetching listing data for the AI prompt

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Feature flag tested (on/off)
- [ ] AI graceful degradation tested
- [ ] Mobile tested at 375px
- [ ] Accessibility requirements met
- [ ] PR opened and linked to this ticket
