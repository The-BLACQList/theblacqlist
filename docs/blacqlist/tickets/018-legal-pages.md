# Ticket 018: Legal Pages — Privacy Policy and Terms of Service

## Status
Draft

## Phase
Phase 2: Public Marketing and Discovery Shell

## Priority
P1

## Feature Area
Legal

## Context
The BLACQList collects personal data (email, profile information, usage analytics) and must publish a Privacy Policy and Terms of Service before any public launch. These pages are legal requirements, not optional marketing copy. Both pages are fully static at MVP — no dynamic data, no auth state. They are linked from the footer on every page of the platform (Ticket 015 app shell). Source: `docs/blacqlist/ux/mvp-screen-map.md` (footer links, legal section), `docs/blacqlist/design/design-brief.md` (editorial page layout).

## User Story
As a visitor or registered user, I want to read the platform's Privacy Policy and Terms of Service in a clear, accessible format, so that I can understand how my data is handled and what rules govern my use of the platform.

## Scope
- `app/privacy/page.tsx` — Static Server Component with `export const revalidate = false`
- `app/terms/page.tsx` — Static Server Component with `export const revalidate = false`
- Privacy Policy sections: data collected, how data is used, third-party services, user rights, cookies, contact information
- Terms of Service sections: account terms, content guidelines, intellectual property, platform rules, dispute resolution, limitation of liability
- `generateMetadata` for both pages with SEO title and description
- Both pages link to each other in the footer of their respective pages (cross-link: "View our Terms of Service" / "View our Privacy Policy")
- Both pages use the root layout nav and footer from Ticket 015

## Out of Scope
- Cookie consent banner / GDPR consent management (post-MVP)
- CCPA "Do Not Sell" opt-out flow (post-MVP)
- Dynamic legal copy served from a CMS (post-MVP)
- Cookie policy as a separate page (can be a section within Privacy Policy at MVP)
- Age-gating or COPPA compliance pages (post-MVP if required)

## Dependencies

| Dependency | Type | Status |
|---|---|---|
| Ticket 015 — App shell layout (nav and footer must exist) | Blocking ticket | Done |
| Legal copy reviewed and approved by user | Content decision | **Open — [LEGAL REVIEW REQUIRED]** |

## UX Notes
- **Screens:** Privacy Policy (`/privacy`) and Terms of Service (`/terms`) — Editorial single-column layout
- **Routes:** `/privacy`, `/terms`
- **Entry points:** Footer links ("Privacy Policy", "Terms of Service") present on every page; sign-up flow may link to Terms during account creation
- **Exit points:** Footer links to other platform pages; cross-link between the two legal pages
- **Mobile at 375px:** Single column at all breakpoints; no grid or multi-column layout; comfortable reading at `text-base leading-relaxed`; table of contents (anchor links) useful on mobile for long pages

### Privacy Policy Page Layout (top to bottom)
1. Page hero: cream background, `<h1>` "Privacy Policy", last-reviewed date line
2. Table of contents: ordered list of anchor links to each section heading
3. Section: What Data We Collect
4. Section: How We Use Your Data
5. Section: Third-Party Services
6. Section: Your Rights
7. Section: Cookies and Tracking
8. Section: Contact Us
9. Cross-link: "Read our Terms of Service →" at bottom

### Terms of Service Page Layout (top to bottom)
1. Page hero: cream background, `<h1>` "Terms of Service", last-reviewed date line
2. Table of contents: ordered list of anchor links to each section heading
3. Section: Account Terms
4. Section: Content Guidelines
5. Section: Intellectual Property
6. Section: Platform Rules
7. Section: Dispute Resolution
8. Section: Limitation of Liability
9. Cross-link: "Read our Privacy Policy →" at bottom

## Design Notes
- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Page background:** `bg-[#FCFAF4]` (cream) for both pages
- **Page hero:** Cream background. `<h1>` in Glacial Indifference `text-4xl md:text-5xl font-bold text-black`. Last-reviewed date in Lato `text-sm text-[#595758]`.
- **Table of contents:** `<ol>` with `list-decimal ml-6 space-y-1`. Links `text-[#E2A428] hover:underline text-sm`.
- **Section headings:** `<h2>` in Glacial Indifference `text-2xl font-bold text-black mt-12 mb-4`. Subsection headings `<h3>` `text-lg font-bold text-black mt-6 mb-2`.
- **Body copy:** Lato `text-base leading-relaxed text-[#595758]`. Paragraphs `mb-4`. Lists `list-disc ml-6 space-y-1`.
- **Third-party services table:** `<table>` with `w-full text-sm border-collapse`. `<th>` `bg-[#19191E] text-white p-3 text-left`. `<td>` `border-b border-gray-200 p-3`.
- **Cross-link at bottom:** `text-[#E2A428] font-bold text-lg hover:underline`
- **Max content width:** `max-w-3xl mx-auto px-4 py-12`
- **Components to use:** No shadcn/ui components required — semantic HTML with Tailwind utility classes is sufficient for editorial text pages
- **States to implement:** Static content only — no loading, error, or empty states

## Data Notes
- **[LEGAL REVIEW REQUIRED]** — The legal copy in this ticket is placeholder content. The actual Privacy Policy and Terms of Service text must be reviewed and approved by the product owner or legal counsel before the page is deployed to production.
- **Tables read:** None — both pages are fully static. No database queries.
- **Operations:** None
- **Migration required:** No
- **Placeholder note:** Until reviewed copy is provided, use clearly marked `[PLACEHOLDER LEGAL COPY — REQUIRES REVIEW]` comments inside each section's prose. The page structure, formatting, and HTML semantics should be fully implemented so only the text content needs to be swapped in after legal review.

## API Notes
- No API calls on either page.
- Both pages are pure static Server Components — no data fetching at build time or runtime.

## Implementation Notes

**Files to create:**
- `app/privacy/page.tsx` — Static Server Component, `export const revalidate = false`
- `app/terms/page.tsx` — Static Server Component, `export const revalidate = false`

**`generateMetadata` for `app/privacy/page.tsx`:**
```tsx
export const revalidate = false

export function generateMetadata(): Metadata {
  return {
    title: 'Privacy Policy — The BLACQList',
    description: 'Learn how The BLACQList collects, uses, and protects your personal information.',
    robots: { index: true, follow: true },
  }
}
```

**`generateMetadata` for `app/terms/page.tsx`:**
```tsx
export const revalidate = false

export function generateMetadata(): Metadata {
  return {
    title: 'Terms of Service — The BLACQList',
    description: 'The terms and conditions governing your use of The BLACQList platform.',
    robots: { index: true, follow: true },
  }
}
```

**Page structure pattern (both pages follow this shape):**
```tsx
export default function PrivacyPage() {
  return (
    <main id="main-content" className="bg-[#FCFAF4] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Hero */}
        <header className="mb-10">
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-black mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#595758]">Last reviewed: [DATE]</p>
        </header>

        {/* Table of contents */}
        <nav aria-label="Page contents" className="mb-12 p-6 bg-white rounded-2xl border border-gray-100">
          <p className="font-bold text-sm text-black mb-3">Contents</p>
          <ol className="list-decimal ml-5 space-y-1 text-sm">
            <li><a href="#data-collected" className="text-[#E2A428] hover:underline">What Data We Collect</a></li>
            {/* ... remaining sections */}
          </ol>
        </nav>

        {/* Sections */}
        <section id="data-collected" className="mb-10">
          <h2 className="font-headline text-2xl font-bold text-black mt-12 mb-4">
            What Data We Collect
          </h2>
          {/* [PLACEHOLDER LEGAL COPY — REQUIRES REVIEW] */}
          <p className="text-base leading-relaxed text-[#595758] mb-4">...</p>
        </section>

        {/* ... remaining sections */}

        {/* Cross-link */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <a href="/terms" className="text-[#E2A428] font-bold text-lg hover:underline">
            Read our Terms of Service →
          </a>
        </div>
      </div>
    </main>
  )
}
```

**Third-party services section — use a table:**
The Privacy Policy's "Third-Party Services" section must include a table listing each external service, its purpose, and a link to its own privacy policy. Use this as a guide:

| Service | Purpose | Privacy Policy |
|---|---|---|
| Supabase | Database and authentication | supabase.com/privacy |
| Stripe | Payment processing | stripe.com/privacy |
| Resend | Transactional email | resend.com/legal/privacy-policy |
| Vercel | Hosting and CDN | vercel.com/legal/privacy-policy |
| Sentry | Error monitoring | sentry.io/privacy |

Render this as a `<table>` element with `<caption>` for accessibility.

**Anchor IDs for table of contents sections:**

Privacy Policy:
- `#data-collected`
- `#data-use`
- `#third-party-services`
- `#your-rights`
- `#cookies`
- `#contact`

Terms of Service:
- `#account-terms`
- `#content-guidelines`
- `#intellectual-property`
- `#platform-rules`
- `#dispute-resolution`
- `#limitation-of-liability`

**Key patterns:**
- Both pages are pure Server Components with `export const revalidate = false` — no `"use client"` directive
- Use semantic HTML throughout: `<main>`, `<header>`, `<section>`, `<nav aria-label="Page contents">`, `<h2>`, `<h3>`, `<p>`, `<ul>`, `<ol>`, `<table>`, `<caption>`
- The table of contents `<nav>` must use `aria-label="Page contents"` to distinguish it from the site navigation `<nav>`
- Anchor links in the table of contents use fragment identifiers matching the `id` on each `<section>` element
- Use `next/link` for the cross-link between pages (internal navigation)
- Section `id` attributes must be lowercase kebab-case and match the table of contents anchor hrefs exactly

**Do not:**
- Fetch data or use `useEffect` — these pages are 100% static
- Use a markdown rendering library (react-markdown, etc.) — hardcode the HTML in JSX
- Add a CMS adapter or remote content source at MVP
- Ship the pages with `[PLACEHOLDER LEGAL COPY — REQUIRES REVIEW]` in production — confirm real copy is inserted before deployment

## Acceptance Criteria
- [ ] Privacy Policy page renders at `/privacy` with `<h1>` "Privacy Policy", all six sections (data collected, data use, third-party services, user rights, cookies, contact), table of contents with working anchor links, and cross-link to `/terms`
- [ ] Terms of Service page renders at `/terms` with `<h1>` "Terms of Service", all six sections (account terms, content guidelines, intellectual property, platform rules, dispute resolution, limitation of liability), table of contents with working anchor links, and cross-link to `/privacy`
- [ ] Third-party services table in Privacy Policy includes at minimum: Supabase, Stripe, Resend, Vercel, Sentry — each with name, purpose, and external privacy policy link
- [ ] Table of contents anchor links on both pages scroll to the correct section on click — each section has the matching `id` attribute
- [ ] Both pages have correct `<title>` and `<meta name="description">` via `generateMetadata`
- [ ] Both pages render correctly at 375px — single column, no horizontal overflow, body text readable at `text-base`
- [ ] Both pages have exactly one `<h1>` per page
- [ ] Footer links "Privacy Policy" and "Terms of Service" in the app shell (Ticket 015) navigate to `/privacy` and `/terms` respectively
- [ ] Neither page renders any placeholder `[PLACEHOLDER LEGAL COPY — REQUIRES REVIEW]` text in the production build — all placeholders replaced with approved copy before merge

## Failure States

| Failure | Condition | User sees | Recovery |
|---|---|---|---|
| Page not found | User navigates to `/privacy` before the route is deployed | Next.js 404 page (`not-found.tsx` from Ticket 019) | Deploy the page |
| Legal copy not reviewed | Page ships with placeholder text | Placeholder text visible to users — legal and reputational risk | Do not merge until legal review is complete; ticket blocked by legal review |
| Broken anchor link | Section `id` does not match table of contents `href` | Page scrolls to top instead of section | Fix the mismatch; test all anchor links before PR review |
| External link to third-party privacy policy is dead | A service changes their privacy policy URL | User gets a 404 on the external site | Audit external links before launch and on a periodic schedule post-launch |

## Edge Cases
- Very long sections (e.g., limitation of liability) — verify the section heading remains legible at all viewport widths; no overflow
- User arrives at `/privacy#cookies` directly via a URL containing a fragment — page must scroll to the "Cookies" section on load; this is handled natively by browser `id` anchor behavior in Next.js
- User with screen reader navigates the table of contents — the `<nav aria-label="Page contents">` wrapping the TOC ensures it is announced as a navigation landmark distinct from the site nav
- Legal copy update after launch — the developer updates the JSX copy and bumps the "Last reviewed" date; no migration or cache invalidation needed (static page regenerates on next deploy)
- Internal cross-links from sign-up flow to Terms of Service — the sign-up form (Ticket 014) links to `/terms`; this page must exist before the sign-up flow is tested in a complete E2E session

## Accessibility Notes
- [ ] Each page has exactly one `<h1>` — the page title ("Privacy Policy" / "Terms of Service")
- [ ] Section headings are `<h2>` elements; subsection headings are `<h3>` — no heading levels are skipped
- [ ] Table of contents is wrapped in `<nav aria-label="Page contents">` — distinct from the site navigation `<nav>`
- [ ] Third-party services table has a `<caption>` element describing its content
- [ ] Table header cells use `<th scope="col">` — not styled `<td>` elements
- [ ] All external links (third-party privacy policy links) open in a new tab with `target="_blank" rel="noopener noreferrer"` and include `aria-label` indicating they open in a new window
- [ ] Anchor links in the table of contents are standard `<a href="#section-id">` elements — keyboard-navigable
- [ ] Body text meets WCAG AA color contrast: `#595758` on `#FCFAF4` background — verify contrast ratio ≥ 4.5:1

## QA Test Cases

| # | Scenario | Role | Steps | Expected result |
|---|---|---|---|---|
| QA-1 | Privacy Policy renders | Anonymous | Navigate to `/privacy` | All six sections render; table of contents present; no placeholder text visible |
| QA-2 | Terms of Service renders | Anonymous | Navigate to `/terms` | All six sections render; table of contents present; no placeholder text visible |
| QA-3 | Table of contents anchor navigation | Anonymous | On `/privacy`, click "Cookies and Tracking" in the table of contents | Page scrolls to the Cookies section; that section's `<h2>` is the first visible element |
| QA-4 | Cross-link between pages | Anonymous | On `/privacy`, click "Read our Terms of Service →" at the bottom | Navigates to `/terms`; page renders correctly |
| QA-5 | Mobile at 375px | Anonymous | Set viewport to 375px; load `/privacy` | Single-column layout; no horizontal overflow; body text readable; table of contents scrollable |
| QA-6 | SEO metadata | Anonymous | View page source for `/privacy` and `/terms` | `<title>Privacy Policy — The BLACQList</title>` and `<title>Terms of Service — The BLACQList</title>` present with correct `<meta name="description">` |

## Security Notes
- Both pages are fully static with no user data access, no auth gating, and no form submissions
- External links to third-party privacy policies use `rel="noopener noreferrer"` to prevent reverse tabnapping
- No server-side data is read — these pages pose no data exposure risk

## Completion Checklist
- [ ] Implementation complete
- [ ] **[LEGAL REVIEW REQUIRED]** — All placeholder legal copy replaced with approved text before merge
- [ ] "Last reviewed" date updated to the actual review date
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] All acceptance criteria verified
- [ ] Anchor links in both tables of contents verified — all navigate to the correct section
- [ ] External links to third-party privacy policies verified (not returning 404)
- [ ] Mobile tested at 375px — both pages
- [ ] Keyboard navigation tested — tab through table of contents, sections, cross-link, external links
- [ ] Accessibility requirements met — single h1, nav aria-label, table caption and th scope, external link aria-labels
- [ ] QA test cases passed
- [ ] PR opened and linked to this ticket
