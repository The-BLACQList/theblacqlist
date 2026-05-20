# Ticket 081: AI admin moderation flags — surface quality issues in admin queue

## Status

Draft

## Phase

Phase 15: AI

## Priority

P3

## Feature Area

AI / Admin

---

## Context

The admin listings queue at `/admin/listings` (Ticket 038) shows all submitted listings awaiting review. At volume, admins struggle to triage which listings need attention most. This ticket adds AI-assisted quality flagging: when a new listing is created, a fire-and-forget async call runs `generateModerationFlags(listingId)` — a Server Action that invokes the Claude API with the listing's data and returns an array of structured flags such as `description_too_short`, `missing_category`, `potential_spam`, and `inappropriate_content`. Each flag carries a `severity` (`info` / `warning` / `critical`) and a `suggested_action`. Flags are persisted to the `moderation_queue` table. The admin listings table then shows a color-coded badge displaying the count of unresolved flags per listing.

All AI functionality is gated behind the `AI_FEATURES_ENABLED` environment variable. When the flag is false, `generateModerationFlags` returns an empty array immediately without calling the Anthropic API. This prevents accidental AI spend in development and staging environments.

Source documents: `docs/blacqlist/architecture/production-architecture.md` § 10 (AI Architecture); Ticket 038 (admin listings table); Ticket 079 (AI service foundation).

---

## User Story

As an admin, I want to see AI-generated quality flags on submitted listings, so that I can prioritize my review queue and quickly identify listings that need correction before they are published.

---

## Scope

**In scope:**

- `lib/ai/prompts/moderation-flags.ts` — versioned prompt template for the moderation flags call; accepts a structured listing record and returns a typed flags array
- `lib/ai/services/moderation-flags.ts` — server-side service wrapping the Anthropic API call; validates response shape; handles timeout (10s) and API errors with graceful degradation
- Server Action `generateModerationFlags(listingId: string): Promise<ModerationFlag[]>` in `lib/actions/ai-actions.ts`; reads listing + `listing_details_business` records using service role client; calls the AI service; writes flag rows to `moderation_queue`
- `moderation_queue` table additions: columns `flags jsonb` (array of flag objects), `ai_generated boolean DEFAULT false`, `ai_generated_at timestamptz`
- Admin listings table (`app/admin/listings/components/ListingsTable.tsx`) updated to show a `FlagBadge` component per listing row — colored dot with count; clicking the badge opens a popover listing flag text and severity
- Fire-and-forget integration in the `createListing` Server Action (Ticket 033/039 scope): after the listing insert succeeds, call `generateModerationFlags` as a non-blocking async operation — do not `await` the result; do not let AI failure block listing creation
- `AI_FEATURES_ENABLED` guard: check at the top of `generateModerationFlags`; if false, return `[]` immediately

**Out of scope:**

- AI-assisted content suggestions for owners (future AI ticket)
- Admin ability to manually add moderation flags (Ticket 038 scope)
- Automated publishing or rejection based on AI flag severity (product decision deferred)
- Prompt management UI (V3)

---

## Dependencies

| Dependency                                 | Type            | Status                                              |
| ------------------------------------------ | --------------- | --------------------------------------------------- |
| Ticket 038: Admin listings table           | Blocking ticket | In Progress                                         |
| Ticket 039: Admin listing detail and edit  | Blocking ticket | In Progress                                         |
| Ticket 079: AI service foundation          | Blocking ticket | Must be completed first                             |
| `moderation_queue` table (Ticket 012)      | Database        | Must exist                                          |
| `ANTHROPIC_API_KEY` environment variable   | Infrastructure  | Must be set in all environments where AI is enabled |
| `AI_FEATURES_ENABLED` environment variable | Infrastructure  | Must be defined in `.env.example`                   |

**Risk:** Ticket 079 is listed as a dependency. If that ticket does not yet exist as a formal ticket in the backlog, this ticket assumes an AI service foundation (Anthropic SDK client initialization at `lib/ai/client.ts`) has been established. If not, the developer must create `lib/ai/client.ts` as the first step of this ticket.

---

## UX Notes

- **Screen:** Admin Listings Table (`/admin/listings`) — existing table from Ticket 038
- **Entry point:** Admin navigates to `/admin/listings`; flags are surfaced inline per row, not as a separate page
- **Flag badge display:** A small badge to the right of the listing status indicator; badge color based on highest-severity flag (`critical` = red, `warning` = amber, `info` = gray); badge shows the total count of unresolved flags
- **Flag popover:** Clicking the badge opens a `Popover` (shadcn/ui) showing each flag's label, severity indicator, and suggested action text; max 4 flags shown; truncates with "and N more" for longer lists
- **No flags state:** No badge rendered when `flags` is empty or null — do not show a "0 flags" badge
- **Mobile behavior:** On mobile, the badge appears in the listing row; tapping it opens the popover full-width

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components to use:** `Badge` (shadcn/ui), `Popover`, `PopoverTrigger`, `PopoverContent`
- **Flag severity colors:** Critical = `bg-red-100 text-red-800 border-red-200`; Warning = `bg-amber-100 text-amber-800 border-amber-200`; Info = `bg-gray-100 text-gray-700 border-gray-200`
- **Prompt file:** `lib/ai/prompts/moderation-flags.ts` — export a `buildModerationFlagsPrompt(listing: ListingRecord): string` function; prompt must be versioned (include a `PROMPT_VERSION` constant in the file)
- **States to implement:** Default (flags loaded from DB), Loading (not applicable — flags load with the table), Empty (no badge), Error (if badge data fails to JOIN, silently omit — do not show an error in the admin table row)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `moderation_queue`, `listings`, `listing_details_business`
- **Entities involved:** `moderation_queue`, `listings`
- **Operations:**
  - `SELECT` listing + `listing_details_business` (service role) to build the prompt payload
  - `INSERT` flag rows into `moderation_queue` after AI response is received
  - `SELECT` flag rows JOIN'd into admin listings table query
- **Migration required:** Yes — `ALTER TABLE moderation_queue ADD COLUMN flags jsonb, ADD COLUMN ai_generated boolean DEFAULT false, ADD COLUMN ai_generated_at timestamptz NULL` (migration filename: `add-ai-flags-to-moderation-queue`)
- **Flag data shape stored in `flags` column:**
  ```json
  [
    {
      "code": "description_too_short",
      "severity": "warning",
      "message": "Description is fewer than 50 characters.",
      "suggested_action": "Request the owner to expand the description to at least 100 characters."
    }
  ]
  ```
- **Known flag codes:** `description_too_short`, `missing_category`, `missing_contact_info`, `potential_spam`, `inappropriate_content`, `duplicate_suspected`, `low_quality_description`
- **RLS policies:** Admin listings table queries use service role — no RLS concern; `moderation_queue` SELECT is service-role only

---

## API Notes

- **No new public API endpoints.** All interactions use Server Actions and the existing admin data access pattern.
- **Anthropic API call:** `POST https://api.anthropic.com/v1/messages` via the Anthropic Node.js SDK; model: `claude-3-haiku-20240307` (cheapest, fastest — appropriate for moderation screening); max tokens: 500; timeout: 10s
- **Auth required:** Server-side only — Anthropic API key is server-only env var
- **Error handling:** If the Anthropic API returns an error or times out, `generateModerationFlags` must log the error to Sentry and return `[]` — the listing creation flow must not be affected

---

## Implementation Notes

**Files to create:**

- `lib/ai/client.ts` — Anthropic SDK client initialization (if not already created by Ticket 079)
- `lib/ai/prompts/moderation-flags.ts` — prompt builder; accepts `ListingRecord & { description: string }`; returns a structured prompt string
- `lib/ai/services/moderation-flags.ts` — calls Anthropic API, parses response JSON, returns `ModerationFlag[]`
- `supabase/migrations/[timestamp]_add-ai-flags-to-moderation-queue.sql` — schema migration

**Files to modify:**

- `lib/actions/ai-actions.ts` (or create) — add `generateModerationFlags` Server Action
- `lib/actions/listing-actions.ts` — after successful listing INSERT, fire `generateModerationFlags(listingId)` without awaiting
- `app/admin/listings/components/ListingsTable.tsx` — add `FlagBadge` column; update the admin listings query to JOIN `moderation_queue` flags
- `.env.example` — add `AI_FEATURES_ENABLED=false` and `ANTHROPIC_API_KEY=` with comments

**Key patterns:**

- Follow the service layer pattern: prompt logic in `lib/ai/prompts/`, API call in `lib/ai/services/`, orchestration in `lib/actions/`
- Fire-and-forget: in `listing-actions.ts`, use `generateModerationFlags(listingId).catch(err => captureException(err))` — never `await`
- Response parsing: the AI response must be valid JSON matching the `ModerationFlag[]` type; if parsing fails, log and return `[]`
- Prompt version: include `PROMPT_VERSION = 'v1'` as a constant; store alongside flag rows in `moderation_queue.notes` field

**Do not:**

- Call the Anthropic API from any client component
- Store the Anthropic API key in any `NEXT_PUBLIC_*` variable
- Block listing creation on AI flag generation — it is strictly fire-and-forget
- Log listing content or descriptions in Sentry events (PII risk)

---

## Acceptance Criteria

- [ ] Given `AI_FEATURES_ENABLED=true` and a new listing is created, `generateModerationFlags` is called asynchronously and flag rows appear in `moderation_queue` within 15 seconds of listing creation
- [ ] Given `AI_FEATURES_ENABLED=false`, `generateModerationFlags` returns `[]` immediately without making an Anthropic API call
- [ ] Given the Anthropic API times out or returns a 500 error, listing creation succeeds normally and no flag rows are written (degraded gracefully)
- [ ] Admin listings table shows a colored badge with flag count for listings that have unresolved AI flags
- [ ] Badge color reflects the highest severity flag for that listing (critical > warning > info)
- [ ] Clicking the badge shows a popover with individual flag codes, severity labels, and suggested action text
- [ ] Listings with no AI flags show no badge — not a "0 flags" indicator
- [ ] `ANTHROPIC_API_KEY` is not present in any client-side bundle (verify via browser network tab)
- [ ] TypeScript: `ModerationFlag` type is defined and all AI service files compile with zero errors
- [ ] Migration applies cleanly to a fresh local Supabase instance

---

## Failure States

| Failure                              | User-visible behavior                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Anthropic API timeout (> 10s)        | Listing creation succeeds; no flags appear; error logged to Sentry; no user-visible impact |
| Anthropic API returns malformed JSON | Same as timeout — `[]` returned; error logged; listing creation unaffected                 |
| `AI_FEATURES_ENABLED` not set        | Treated as `false`; no API call made; admin table shows no flag badges                     |
| DB write for flags fails             | Error logged to Sentry; listing creation unaffected; admin sees no flags for this listing  |
| Flag badge DB query fails            | Badge is silently omitted for the affected row; no error shown in admin table              |

---

## Edge Cases

- Listing created before `moderation_queue` schema migration has run: `generateModerationFlags` will fail on INSERT; catch this error and log without crashing
- Listing with `status = 'draft'` or `status = 'pending_review'`: flags should still be generated — admins review listings in all non-published states
- Very long listing description (> 2000 chars): truncate to 2000 chars before building the prompt to control token cost
- AI returns `inappropriate_content: critical` for a legitimate listing: admin sees the flag but retains full discretion to dismiss — no automated rejection

---

## Accessibility Notes

- [ ] Flag badge is keyboard-reachable (`tabindex="0"` on the badge trigger)
- [ ] Popover is announced to screen readers (`aria-describedby` or `role="tooltip"` on the popover content)
- [ ] Severity is conveyed by both color and text label — not color alone
- [ ] Popover closes on Escape key

---

## QA Test Cases

| #    | Scenario                          | Role  | Steps                                                                                                                                               | Expected result                                                                                                                    |
| ---- | --------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| QA-1 | Flags generated on new listing    | Admin | 1. Set `AI_FEATURES_ENABLED=true`. 2. Create a listing with a 20-character description and no category. 3. Wait 15s. 4. Check admin listings table. | Listing row shows an amber or red flag badge with at least 1 flag; popover shows `description_too_short` and/or `missing_category` |
| QA-2 | AI disabled — no flags generated  | Admin | 1. Set `AI_FEATURES_ENABLED=false`. 2. Create a listing. 3. Check admin listings table.                                                             | No flag badge shown; `moderation_queue` has no AI-generated rows for this listing                                                  |
| QA-3 | API error graceful degradation    | Admin | 1. Set `ANTHROPIC_API_KEY` to an invalid value. 2. Create a listing.                                                                                | Listing creates successfully; no flag badge; Sentry captures the AI error                                                          |
| QA-4 | Listing with high-quality content | Admin | 1. Create a listing with 500+ char description, category set, contact info present. 2. Wait 15s.                                                    | Either no flags or only `info`-severity flags; no false `critical` or `warning` flags                                              |
| QA-5 | Flag popover on mobile at 375px   | Admin | 1. Open `/admin/listings` on a 375px viewport. 2. Tap a flag badge.                                                                                 | Popover opens full-width below the badge; readable; tapping outside closes it                                                      |

---

## Security Notes

- `ANTHROPIC_API_KEY` is server-only. Never in `NEXT_PUBLIC_*`. Verify in Vercel environment variable dashboard before each deployment.
- Listing content sent to the Anthropic API must not include PII fields (`phone`, `email`, `address_line_1`). The prompt builder must strip these fields before constructing the prompt.
- AI-generated flag content must not be rendered as HTML — render as plain text only to prevent prompt-injection XSS via the API response.

---

## Completion Checklist

- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All four states implemented (loading, empty, error, success)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
