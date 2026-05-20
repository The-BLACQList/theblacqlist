# Ticket 017: For Business and About Static Pages

## Status
Draft

## Phase
Phase 2: Public Marketing and Discovery Shell

## Priority
P2

## Feature Area
Marketing

## Context
The For Business page is a primary SEO and conversion surface for business owners who discover the BLACQList through search or referral. It must clearly communicate the value of claiming or creating a BLACQList Page and convert visitors into owners. The About page communicates the platform's mission and builds cultural trust. Both are static marketing pages with no dynamic data at MVP. Source: `docs/blacqlist/ux/mvp-screen-map.md` section 1 (For Business and About page specs).

## User Story
As a Black business owner who discovers The BLACQList, I want to understand what I get by claiming or creating a page, so that I can confidently take the first step to establish my presence on the platform.

## Scope
- `app/for-business/page.tsx` — Static Server Component with `export const revalidate = false`
- `app/about/page.tsx` — Static Server Component with `export const revalidate = false`
- For Business page sections: hero (headline + subhead + two CTAs), social proof line (listing count — fetched at build time), value prop grid (3 feature blocks with icons), how-it-works steps (3 numbered steps), final CTA band
- About page sections: about hero, mission block, origin story block, team section (names + titles + photo/initial placeholders), single Amber Gold CTA at bottom
- Shared layout components: `PageHero`, `SectionBlock` reusable across both pages
- `generateMetadata` for both pages with SEO title and description
- Both pages use the root layout nav and footer from Ticket 015

## Out of Scope
- Claim flow itself (separate ticket)
- Add business form (separate ticket)
- Dynamic listing count above a hardcoded stub — if the count fetch fails, fall back to a static approximate number ("hundreds of businesses")
- Team member photos (placeholder initials at MVP — real photos added via CMS or direct code update post-launch)

## Dependencies
- Depends on: Ticket 015 — App shell layout (nav and footer must exist)

## UX Notes
- **Screens:** For Business (`/for-business`) and About (`/about`) — Full-bleed hero and Constrained content layouts
- **Routes:** `/for-business`, `/about`
- **Entry points:** Homepage "For Business" band CTAs, nav "For Business" link, direct URL, organic search
- **Exit points:** For Business → Claim flow (`/claim`), Add Business form (`/add-business`). About → Discover (`/discover`).
- **Mobile at 375px:**
  - For Business hero: headline wraps, two CTA buttons stacked vertically (not side-by-side)
  - Value prop grid: single column on mobile
  - How-it-works steps: stacked vertically
  - About page: editorial single-column at all breakpoints

### For Business Page Layout (top to bottom)
1. **Hero section** — Dark background (`bg-[#19191E]`), full-bleed. Headline: "You deserve a better page." (Glacial Indifference, `text-4xl md:text-6xl`). Subhead in Lato (2 sentences on the BLACQList Page value). Two buttons: "Claim Your Page" (Amber Gold) + "Add Your Business" (ghost outline white). Social proof line directly below buttons: "Join [N]+ Black-owned businesses already listed."
2. **Value prop grid** — 3 cards on cream background. Card 1: icon + "Polished by default" + 2 lines of copy. Card 2: "Found by your community." Card 3: "Trusted with a badge."
3. **How it works** — 3 numbered steps on white or cream: (1) Claim or create your page (2) Complete your profile (3) Get found. Each step: number (large Amber Gold), heading, 1 sentence copy.
4. **Final CTA band** — Brand Black background. Headline "Ready to get found?" Primary button "Claim Your Page Free" (Amber Gold). Secondary text link "Add a new business →" below.

### About Page Layout
1. About hero: Cream background, large mission quote in Glacial Indifference, subhead in Lato
2. Mission block: 2–3 paragraphs of mission copy
3. Origin story block: editorial prose
4. Team section: grid of team member cards (name, title, initials placeholder for photo)
5. Single Amber Gold CTA button: "Discover The BLACQList →" → `/discover`

## Design Notes
- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **For Business hero:** `bg-[#19191E] text-white`, full-bleed. Headline `font-bold text-4xl md:text-6xl tracking-tight`. Amber Gold primary CTA `bg-[#E2A428] text-black font-bold px-6 py-3 rounded-full`. Ghost CTA `border border-white text-white bg-transparent px-6 py-3 rounded-full hover:bg-white/10`.
- **Value prop cards:** `bg-white rounded-2xl p-6 shadow-sm`. Icon: 48px Amber Gold SVG. Heading: `text-xl font-bold text-black` (Glacial Indifference). Body: `text-sm text-[#595758]` (Lato).
- **How it works:** Step numbers `text-6xl font-bold text-[#E2A428]` (Glacial Indifference). Step headings `text-xl font-bold`. Step copy `text-sm text-gray-600`.
- **Final CTA band:** `bg-black py-20 text-center`. Headline `text-3xl font-bold text-white`.
- **About page:** Background `bg-[#FCFAF4]` (cream). Mission quote `text-3xl md:text-4xl font-bold text-black italic` (Glacial Indifference). Section headings `text-2xl font-bold`. Body `text-base leading-relaxed text-[#595758]` (Lato).
- **Team cards:** `bg-white rounded-xl p-6 text-center`. Avatar placeholder: `w-16 h-16 rounded-full bg-[#E2A428] text-black font-bold flex items-center justify-center text-xl` (initials). Name `font-bold`. Title `text-sm text-gray-500`.
- **Components to use:** shadcn/ui `Card`, `CardContent`, `Button`
- **States to implement:** Static content — no loading, empty, or error states. Only the listing count on the For Business social proof line has a potential fallback (see Edge Cases).

## Data Notes
- **Tables read (For Business page only):** `listings` — count of published listings for the social proof line. Fetched at build time (ISR `revalidate = false` means it is static until next deployment).
- **Operations:** `SELECT COUNT(*) FROM listings WHERE status = 'published' AND deleted_at IS NULL`
- **Fallback:** If the count fetch fails at build time, render "hundreds of Black-owned businesses" as static copy. Do not show an error.
- **Migration required:** No

## API Notes
- **For Business social proof line** — server-side Supabase query directly in the page component (not via an API route). Uses the anonymous Supabase client with service-role fallback if needed.
- No other API calls on either page.

## Implementation Notes

**Files to create:**
- `app/for-business/page.tsx`
- `app/about/page.tsx`
- `components/marketing/PageHero.tsx` — Reusable hero: `{ headline, subhead, ctaButtons, backgroundVariant: 'dark' | 'cream' }`
- `components/marketing/SectionBlock.tsx` — Reusable section wrapper: `{ title?, children, background: 'white' | 'cream' | 'black' }`
- `components/marketing/ValuePropGrid.tsx` — Three feature cards
- `components/marketing/HowItWorksSteps.tsx` — Numbered step list
- `components/marketing/TeamGrid.tsx` — Team member cards

**For Business listing count fetch:**
```tsx
// app/for-business/page.tsx
async function getListingCount(): Promise<number> {
  try {
    const supabase = createServerComponentClient()
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .is('deleted_at', null)
    return count ?? 0
  } catch {
    return 0 // graceful fallback
  }
}
```

**Key patterns:**
- Both pages are pure Server Components with `export const revalidate = false` — no `"use client"` directives
- Use `next/image` for any images (OG image, hero background if added)
- All link CTAs use `next/link` — not `<a href>`

**Do not:**
- Fetch dynamic data on the About page — it is fully static
- Use `useEffect` or any React state on these pages
- Add configuration or CMS fields — static copy in JSX is sufficient for MVP

## Acceptance Criteria
- [ ] For Business page renders at `/for-business` with hero, value prop grid, how-it-works steps, and final CTA band
- [ ] For Business hero displays "Claim Your Page" (Amber Gold) and "Add Your Business" (ghost outline) buttons side-by-side on desktop; stacked vertically on mobile at 375px
- [ ] Social proof line shows a listing count or fallback copy "hundreds of Black-owned businesses" if count is 0 or fetch fails
- [ ] How-it-works section shows exactly 3 numbered steps with Amber Gold step numbers
- [ ] About page renders at `/about` with mission statement, origin story, team section, and single Amber Gold CTA
- [ ] Team cards render with initials placeholder if no photo URL is provided
- [ ] Both pages have correct `<title>` and `<meta name="description">` via `generateMetadata`
- [ ] Both pages render correctly at 375px mobile — no horizontal overflow, all text readable at base font size, CTAs full-width on mobile
- [ ] Both pages have exactly one `<h1>` per page

## Failure States

| Failure | User-visible behavior |
|---|---|
| Listing count fetch fails at build time | Social proof line renders "hundreds of Black-owned businesses" static fallback text. No error shown. |
| Team member photo URL returns 404 | Initials placeholder shown instead. `next/image` `onError` handler or CSS fallback hides broken image and shows placeholder. |
| Page content missing at build time | Not applicable — all content is hardcoded JSX for MVP. |

## Edge Cases
- If listing count is 0 (early development environment), the social proof line must not say "Join 0 businesses" — add a conditional: if count < 10, show the fallback string
- Long team member names on the About page — team card layout must handle names wrapping to 2 lines without breaking the grid
- For Business page visited by an authenticated business owner — CTA "Claim Your Page" should link to `/claim` (claim flow); "Add Your Business" links to `/add-business`. Both links are valid for any auth state — the claim and add-business flows handle auth gating internally.

## Accessibility Notes
- [ ] Each page has exactly one `<h1>` — the hero headline
- [ ] Value prop cards have `<h3>` headings (not styled `<div>` elements)
- [ ] How-it-works step numbers are marked as `aria-hidden="true"` — the step heading contains the meaningful content
- [ ] All CTA buttons have descriptive labels ("Claim Your Page" — not just "Click here")
- [ ] Team section avatars use `alt=""` for the initials placeholder (decorative) and `alt="[Name]"` if a real photo is added

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | For Business page renders | Anonymous | Navigate to `/for-business` | All four sections render: hero, value props, how-it-works, final CTA band |
| QA-2 | Social proof fallback | Engineer | Set listing count to 0 in test; load `/for-business` | "Join hundreds of Black-owned businesses" fallback copy visible (not "Join 0 businesses") |
| QA-3 | For Business at 375px | Anonymous | Set viewport to 375px; navigate to `/for-business` | Hero CTA buttons stacked vertically; value prop cards single column; no horizontal overflow |
| QA-4 | About page renders | Anonymous | Navigate to `/about` | Mission block, origin story, team section, and "Discover The BLACQList →" CTA all visible |
| QA-5 | SEO metadata | Anonymous | View page source for `/for-business` | `<title>For Business — The BLACQList</title>` and descriptive `<meta name="description">` present |

## Security Notes
- Both pages are fully static with no user data access or auth gating
- The listing count query uses the anonymous Supabase client — RLS policies ensure only published listings are counted

## Completion Checklist
- [ ] Implementation complete
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Static content pages — no loading/empty/error states required beyond the social proof count fallback
- [ ] Mobile tested at 375px — both pages
- [ ] Keyboard navigation tested — CTAs reachable via Tab, Enter activates links
- [ ] Accessibility requirements met — single h1, descriptive CTA labels, decorative aria-hidden
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
