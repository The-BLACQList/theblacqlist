# Ticket 057: User onboarding flow — post-signup role selection and intent (`/onboarding`)

## Status
Draft

## Phase
Phase 9: Supporter Account

## Priority
P1

## Feature Area
Onboarding

## Context
After email verification, new users land on `/onboarding`. This 2–3 step flow collects role intent, optionally surfaces the business search/claim path for owners, and ends with an explore prompt. The route is auth-protected (Ticket 058 middleware) and skippable at every step. On completion or skip, the `completeOnboarding` SA writes the confirmed role to `user_roles` and marks `profiles.onboarding_completed_at`. This is the moment where the platform differentiates supporter experience from owner experience — getting the branching right is critical for downstream routing (supporters → `/discover`, owners → `/dashboard`).

Source documents: `docs/blacqlist/ux/mvp-screen-map.md` (Onboarding `/onboarding`), `docs/blacqlist/architecture/server-actions-plan.md` (`setOnboardingRole`), `docs/blacqlist/data/database-schema-plan.md` (`user_roles`, `profiles`).

## User Story
As a newly registered user, I want to confirm my intent (supporter or business owner) and be guided to the right starting point, so that the platform immediately serves my specific goals.

## Scope
- `app/onboarding/page.tsx` — Server Component: fetches current user's profile + role from `user_roles`; redirects to `/discover` (supporter) or `/dashboard` (owner) if onboarding is already complete (`profiles.onboarding_completed_at IS NOT NULL`)
- `app/onboarding/components/OnboardingShell.tsx` — Client Component: owns the step state (`useState` for step 1/2A/2B/3), renders the step progress indicator, renders the skip link, and composes the step sub-components below
- `app/onboarding/components/steps/RoleConfirmStep.tsx` — Step 1: confirms or changes the role set at sign-up; two paths from this step depending on current role
- `app/onboarding/components/steps/BusinessSearchStep.tsx` — Step 2A (owner path): inline search bar + city selector; results as listing preview cards; "Claim this listing" card action navigates to `/claim/[listing-id]`; "I don't see my business" link routes to `/add-business`
- `app/onboarding/components/steps/AddBusinessPromptStep.tsx` — Step 2B (owner, no listing found): copy block + "Start building your page →" button → `/add-business`
- `app/onboarding/components/steps/ExplorePromptStep.tsx` — Step 3 (both paths): supporter → browse categories; owner → "Explore The BLACQList →"
- `lib/actions/account/setOnboardingRole.ts` — SA: validates role value; upserts `user_roles` row with confirmed role; sets `profiles.onboarding_completed_at = now()`; returns `ActionResult<{ role: string }>`
- Skip behavior: "Skip for now" link calls `setOnboardingRole` with the current role from `user_roles` (whatever was set at sign-up) then redirects
- Business search in Step 2A calls the existing search API (`GET /api/search?q=...&city=...`); no new API endpoint required

## Out of Scope
- Notification preferences (deferred to V1 — the brief referenced these for MVP but the SA plan and screen map do not include a notification preferences step)
- Re-onboarding flow for existing users who change their role (V1)
- Progress persistence to server between steps (client-only step state is sufficient for this short flow)
- OAuth provider detection in the security section (V1)

## Dependencies
- Depends on: Ticket 014 (auth flows — email verification redirects to `/onboarding`; session management)
- Depends on: Ticket 015 (app shell — no full nav on onboarding, but footer and wordmark are from shell)
- Depends on: Ticket 008 (`profiles`, `user_roles` tables)
- Depends on: Ticket 013 (RLS — `user_roles` INSERT/UPDATE where `user_id = auth.uid()`)
- Depends on: Ticket 058 (auth middleware — `/onboarding` requires auth; already-onboarded users are redirected by the Server Component before render)
- Soft dependency: Ticket 025 (`GET /api/search`) — Step 2A business search calls this endpoint; if not yet live, the step can render a loading state with a "Search not yet available" fallback

## UX Notes
- **Screen:** Onboarding — `docs/blacqlist/ux/mvp-screen-map.md` → "Onboarding (`/onboarding`)"
- **Route:** `/onboarding`
- **Layout:** Minimal (no full nav, no footer); BLACQList wordmark centered at top; step progress indicator below wordmark ("Step 1 of 3")
- **Step 1 — Role + Intent:**
  - Heading: "Welcome. Let's get you set up."
  - Role confirmed from sign-up. Two branches:
    - **Owner path:** "You're set up as a Business Owner. Ready to find or create your page?" Two buttons: "Find my business →" (Step 2A) and "Add a new business →" (Step 2B)
    - **Supporter path:** "You're set up as a supporter. Ready to explore?" One button: "Start exploring →" (jumps to Step 3)
  - If user wants to change their role, a small text link below: "Change role" opens a role-selector UI within Step 1 (two option cards: Supporter / Business Owner) — after selecting, the button set updates accordingly
- **Step 2A — Business Search:**
  - Heading: "Find your business."
  - Search bar + city selector inline. Results render as listing preview cards (name, city, category, claim status badge)
  - Each card: "Claim this listing" button → navigates to `/claim/[listing-id]`
  - If no results or after viewing: "I don't see my business here →" link → `/add-business` (ends the onboarding flow; SA marks complete)
  - Loading state: skeleton cards (3 rows) while search API fetches
- **Step 2B — Add Business Prompt:**
  - Heading: "Let's create your BLACQList Page."
  - Short copy: "We'll walk you through building your page in a few minutes." One Amber Gold button: "Start building your page →" → `/add-business`
- **Step 3 — Explore Prompt:**
  - Heading: "You're all set."
  - Supporter: "Start by browsing near you." Three category shortcut links in Amber Gold-outline pill style
  - Owner (after completing step 2): "Your page is on its way. While you wait, explore the platform." with "Explore The BLACQList →" link → `/discover`
  - This is the final step; no "Continue" button — only the navigation links and the skip link
- **Skip behavior:** "Skip for now" text link in upper-right of every step. Calls `setOnboardingRole` SA with current role from sign-up, then redirects: supporters → `/discover`, owners → `/dashboard`
- **Progress indicator:** Three dots or "Step N of 3" text counter; current step is Amber Gold; completed steps are filled; future steps are gray
- **Mobile (375px):** Full-width single-column; buttons are full-width; step indicator is centered; wordmark is centered; skip link is in the upper-right corner at `fixed` or `sticky` positioning so it stays accessible as the step content changes

## Design Notes
- **Design brief:** `docs/blacqlist/design/blacqlist-page-design-system.md`
- **Colors:** Amber Gold `#E2A428` for primary buttons and active step indicator; Pale Lavender `#E9E9F7` for the role option cards (selected state: Amber Gold border + Cream background); Cream `#FCFAF4` for page background
- **Fonts:** Glacial Indifference Bold for step headings; Lato Regular for body copy; Quicksand Bold Italic for primary CTA button labels
- **Components:** shadcn/ui `Button` (default Amber Gold, ghost for secondary actions), `Card` (for role option cards in role change), `Badge` (claim status on search result cards); `Skeleton` for search loading state
- **Layout:** Max-width `max-w-lg` centered; no sidebar; `py-12` vertical padding from wordmark to step content
- **States:** Step 1 default, Step 1 role-change mode, Step 2A loading (search), Step 2A results, Step 2A empty (no results), Step 2B, Step 3, Saving/redirecting after skip or complete

## Data Notes
- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `user_roles`, `profiles`
- **Fields involved:**
  - `user_roles`: `user_id`, `role` (text, enum: `'supporter'`, `'owner'`, `'admin'`), `listing_id` (nullable FK — linked on claim approval, not during onboarding), `created_at`
  - `profiles`: `id`, `display_name`, `onboarding_completed_at` (timestamptz, null until completed or skipped)
- **Operations:**
  - SELECT: `user_roles WHERE user_id = auth.uid()` — fetched in Server Component to determine initial role and redirect if already onboarded
  - SELECT: `profiles WHERE id = auth.uid()` — check `onboarding_completed_at`
  - UPSERT via `setOnboardingRole` SA: `user_roles` row for `user_id = auth.uid()` with the confirmed `role`; UPDATE `profiles.onboarding_completed_at = now()` where `id = auth.uid()`
- **Validation rules:** `role` must be `'supporter'` or `'owner'` — validated server-side in SA via zod enum; no other fields modified by this SA
- **RLS:** `user_roles` INSERT and UPDATE where `user_id = auth.uid()`; `profiles` UPDATE where `id = auth.uid()`
- **Migration required:** No — `user_roles` and `profiles` tables exist from Ticket 008; `onboarding_completed_at` column must be confirmed in Ticket 008's schema; if missing, add as a no-migration-needed column addition in this ticket's scope

## API Notes
- **Server Actions plan:** `docs/blacqlist/architecture/server-actions-plan.md` → `setOnboardingRole` (`lib/actions/account/setOnboardingRole.ts`)
- **`setOnboardingRole(input)`:** `{ role: 'supporter' | 'owner' }` → `ActionResult<{ role: string, redirectTo: string }>` where `redirectTo` is `/discover` for supporters and `/dashboard` for owners; SA sets `profiles.onboarding_completed_at = now()` and upserts `user_roles`
- **Business search in Step 2A:** `GET /api/search?q=[query]&city=[city]&limit=5` — calls existing search Route Handler (Ticket 025); no new endpoint
- **Auth required:** Yes — `/onboarding` is auth-protected by middleware (Ticket 058); SA validates session on Step 1 via `supabase.auth.getUser()`
- **Error codes:** `AUTH_REQUIRED` (session expired mid-flow), `VALIDATION_ERROR` (invalid role value), `OPERATION_FAILED` (DB upsert failure)

## Implementation Notes
**Files to create:**
- `app/onboarding/page.tsx`
- `app/onboarding/components/OnboardingShell.tsx`
- `app/onboarding/components/steps/RoleConfirmStep.tsx`
- `app/onboarding/components/steps/BusinessSearchStep.tsx`
- `app/onboarding/components/steps/AddBusinessPromptStep.tsx`
- `app/onboarding/components/steps/ExplorePromptStep.tsx`
- `lib/actions/account/setOnboardingRole.ts`

**Files to modify:**
- `lib/validations/account.ts` — add `onboardingRoleSchema` (zod enum: `'supporter' | 'owner'`)

**Key patterns:**
- `OnboardingShell` is a Client Component (`"use client"`) that owns `const [step, setStep] = useState<OnboardingStep>('role-confirm')` — the step type is a union of the step names
- The Server Component (`page.tsx`) checks `onboarding_completed_at` and redirects before rendering the shell — this prevents already-onboarded users from re-entering the flow
- After `setOnboardingRole` SA returns successfully, the shell calls `router.push(result.data.redirectTo)` — do NOT use `redirect()` inside the SA since the caller needs to handle navigation based on step state
- Step 2A search: use `useState` for query + debounce with `useDebouncedCallback` (300ms) before calling the search API via `fetch`; render results in a Client-side list
- The "I don't see my business" link in Step 2A should call `setOnboardingRole` with `role: 'owner'` before routing to `/add-business` so onboarding is marked complete
- Minimal layout: `app/onboarding/layout.tsx` — no global nav, no footer, wordmark only

**Do not:**
- Add notification preferences to this flow at MVP — the screen map and SA plan do not include this
- Create a separate `app/onboarding/layout.tsx` that interferes with the root layout auth middleware — the route-level layout overrides inner layout only, it does not affect middleware
- Call the search API on every keystroke — debounce at 300ms minimum

## Acceptance Criteria
- [ ] Authenticated users who have not yet completed onboarding see Step 1 on arrival at `/onboarding`
- [ ] Users who have already completed onboarding (`onboarding_completed_at IS NOT NULL`) are redirected away before the page renders: supporters → `/discover`, owners → `/dashboard`
- [ ] Step 1 shows the role confirmed at sign-up; owner path shows "Find my business →" and "Add a new business →" buttons; supporter path shows "Start exploring →"
- [ ] Tapping "Find my business →" advances to Step 2A; tapping "Add a new business →" advances to Step 2B; tapping "Start exploring →" advances to Step 3
- [ ] Step 2A business search fetches results from `GET /api/search`; matching listing cards appear with "Claim this listing" links
- [ ] Tapping "Claim this listing" navigates to `/claim/[listing-id]` (onboarding SA fires first to mark complete)
- [ ] "I don't see my business" link in Step 2A marks onboarding complete and routes to `/add-business`
- [ ] Step 3 renders the correct content for supporter vs. owner path
- [ ] "Skip for now" link is present on every step; clicking it fires `setOnboardingRole` with the current role and redirects to `/discover` (supporter) or `/dashboard` (owner)
- [ ] `setOnboardingRole` SA upserts `user_roles` and sets `profiles.onboarding_completed_at = now()`
- [ ] Step progress indicator shows the current step correctly ("Step 1 of 3", etc.)
- [ ] Mobile (375px): all buttons are full-width; step indicator is centered; skip link is accessible
- [ ] `tsc --noEmit` and `npm run lint` pass with zero errors

## Failure States
| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| `setOnboardingRole` returns `OPERATION_FAILED` | DB upsert fails | Toast: "Couldn't save your preferences. Try again." | Button re-enables; user retries |
| Search API fails (Step 2A) | `GET /api/search` returns non-200 | Inline error below search bar: "Search is temporarily unavailable. Try again." | Retry button below the error |
| Session expired mid-flow | `setOnboardingRole` returns `AUTH_REQUIRED` | Toast with sign-in link: "Your session expired. Sign in again." | Redirect to `/sign-in?next=/onboarding` |
| No search results (Step 2A) | Search returns zero matches | Inline message: "No matching listings found." with "Add a new business" link prominent | Link routes to `/add-business` |

## Edge Cases
- User signed up as a supporter but wants to change to owner during Step 1 — the "Change role" option allows this; `setOnboardingRole` saves the updated role; Step 2A/2B renders accordingly
- User navigates back from Step 2A to Step 1 — step state in `OnboardingShell` allows this; no data is lost; the search query is cleared
- User enters a search query in Step 2A with only whitespace — trim before calling the search API; do not call the API with a blank or whitespace-only query
- User arrives at `/onboarding` directly without having verified their email — Ticket 014's email verification redirect sends them to `/verify-email` first; if they bypass verification (token-less direct nav), the SA session check will validate their session state
- User completes Step 3 and closes the browser tab without clicking the explore/navigate link — `onboarding_completed_at` is set once Step 3 is reached (the SA fires on advancing to Step 3, not on clicking the final navigation link)

## Accessibility Notes
- [ ] The BLACQList wordmark at the top has `alt="The BLACQList"` if rendered as an image, or uses the text wordmark
- [ ] Step progress indicator uses `aria-label="Onboarding progress: Step 1 of 3"` and role-appropriate markup
- [ ] Role option cards in the role-change mode are `role="radio"` within a `role="radiogroup"` with label "Select your role"
- [ ] All buttons have descriptive labels — "Find my business" not "Continue"
- [ ] The skip link is a `<button>` or `<a>` with `aria-label="Skip onboarding and go to [destination]"`
- [ ] Error messages are in an `aria-live="polite"` region
- [ ] Focus management: when advancing to the next step, focus moves to the step heading or the first interactive element

## QA Test Cases
| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| 1 | Supporter happy path | Supporter (new) | 1. Arrive at `/onboarding`. 2. See "Start exploring →". 3. Click. 4. Step 3 shows. 5. Click explore link. | SA fires; `user_roles` upserted; `onboarding_completed_at` set; redirected to `/discover` |
| 2 | Owner — find business | Owner (new) | 1. Step 1 shows owner path. 2. Click "Find my business →". 3. Search "Hair Salon" in Atlanta. 4. Click "Claim this listing". | SA fires on route to `/claim/[id]`; onboarding marked complete |
| 3 | Skip onboarding | Supporter | 1. Click "Skip for now" on Step 1. | SA fires; `onboarding_completed_at` set; redirect to `/discover` |
| 4 | Already onboarded redirect | Supporter (existing, completed onboarding) | 1. Navigate to `/onboarding` directly. | Server Component detects `onboarding_completed_at IS NOT NULL`; redirect to `/discover` before page renders |
| 5 | Mobile 375px | Supporter | 1. Open on 375px. 2. Step 1 visible. | All buttons full-width; step indicator centered; skip link accessible |

## Security Notes
- `setOnboardingRole` SA validates session via `supabase.auth.getUser()` — cannot set onboarding role for another user
- Role value is validated against the allowed enum values server-side — cannot inject an arbitrary role string
- `onboarding_completed_at` is set server-side in the SA — never client-supplied

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] All step states implemented (all three steps, role-change mode, skip)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (tab order through steps, focus management on step advance)
- [ ] Accessibility requirements met
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
