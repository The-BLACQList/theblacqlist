# MVP Screen Map — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth for MVP UI scope
**Owner:** UX / Frontend Architecture
**Audience:** Frontend engineering, QA, design, product

This document inventories every screen in The BLACQList MVP. For each screen it defines the layout type, primary action, secondary actions, key components, data requirements, auth requirement, phase, and a prose description of what the user sees and experiences. Engineers reading this document should be able to identify every component to build, every state to handle, and every data dependency to satisfy — without a verbal briefing.

**Phase key:** MVP = required for public launch. MVP (Beta) = feature-flagged on production at launch, not publicly promoted. V1 = 8–12 weeks post-MVP.

**Layout types used throughout:**

- **Full-bleed hero** — full-viewport-width hero image or background behind content
- **Constrained content** — centered, max-width container (`max-w-5xl` or `max-w-3xl`)
- **Discovery grid** — nav + filter bar + results grid, full page
- **BLACQList Page** — dedicated entity page layout with hero + content sections
- **Dashboard sidebar** — fixed left sidebar + scrollable main content area
- **Admin panel** — admin-specific sidebar + data table or detail panel
- **Multi-step form** — step progress bar + single focused form panel
- **Auth centered** — centered card, no nav, no footer
- **Static** — simple constrained content, no dynamic data

---

## 1. Public Discovery Screens

### Table

| Screen                  | Route                                  | Layout              | Primary Action                                               | Secondary Actions                                     | Key Components                                                                                                                                                                                                                                | Data Required                                                                                            | Auth                           | Phase | Notes                                                                             |
| ----------------------- | -------------------------------------- | ------------------- | ------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------ | ----- | --------------------------------------------------------------------------------- |
| Homepage                | `/`                                    | Full-bleed hero     | Search by keyword + city                                     | Browse categories, browse city spotlight, claim page  | `HeroSearchBar`, `CategoryGrid`, `CitySpotlight`, `FeaturedListingsGrid`, `FeaturedCollectionSlot`, `DollarFlowTeaser`, `ForBusinessBand`, `Footer`                                                                                           | Admin-curated featured listings, category list, one featured collection                                  | No                             | MVP   | Nav transparent → solid on scroll; featured listings via Suspense                 |
| Discover                | `/discover`                            | Discovery grid      | Filter + browse all listings                                 | View listing Page, save listing                       | `DiscoverFilterBar`, `ListingCardGrid`, `EntityTypeFilter`, `CategoryFilter`, `CityFilter`, `EmptyState`, `Pagination`                                                                                                                        | Paginated listings, category list, city list, entity type list                                           | No                             | MVP   | URL search params drive all filter state                                          |
| Search Results          | `/search`                              | Discovery grid      | View listing Page from result card                           | Save listing, clear filters, adjust query             | `SearchBar` (pre-filled), `ActiveFilterChips`, `ResultCountBar`, `ListingCardGrid`, `SearchEmptyState`, `Pagination`, `SortControl`                                                                                                           | Search API results, category list, city list                                                             | No (save gated)                | MVP   | `searchParams` from page props; full-text via Supabase PG FTS                     |
| City Landing            | `/city/[city-slug]`                    | Full-bleed hero     | Browse featured listings in city                             | Browse category shortcuts, view city collections      | `CityHero`, `TopListingsGrid`, `CityCategoryShortcuts`, `CityStatLine`, `Footer`                                                                                                                                                              | City record, top-ranked listings for city, category list, collection featuring city                      | No                             | MVP   | `generateStaticParams` for all cities; ISR 24h                                    |
| City + Category         | `/city/[city-slug]/[category-slug]`    | Discovery grid      | View listing Page from card                                  | Save listing, filter subcategory, sort                | `PageSEOHeader`, `ListingCardGrid`, `FilterBar`, `ResultCount`, `EmptyState`, `Pagination`                                                                                                                                                    | City record, category record, listings filtered by city + category                                       | No (save gated)                | MVP   | `generateStaticParams` for all active city+category combos; ISR 24h               |
| Collections Index       | `/collections`                         | Constrained content | View a collection                                            | —                                                     | `CollectionCardGrid` (cover, title, count, excerpt)                                                                                                                                                                                           | All published collections                                                                                | No                             | MVP   | Admin creates collections; this page is publicly discoverable                     |
| Collection Page         | `/collection/[slug]`                   | Constrained content | View a listing Page from collection                          | Back to collections                                   | `CollectionHeader` (title, editorial intro, cover), `ListingCardGrid`, `BackToCollectionsLink`                                                                                                                                                | Collection record, linked listing records                                                                | No                             | MVP   | ISR 1h; OG meta from collection title + description                               |
| Business BLACQList Page | `/[city-slug]/business/[listing-slug]` | BLACQList Page      | Owner-configured primary CTA (Book/Order/Call/Visit/Message) | Save, Share, view gallery image, view similar listing | `ListingHero`, `TrustBadge`, `SaveButton`, `ShareButton`, `AboutSection`, `CategoryTags`, `HoursBlock`, `ContactBlock`, `SocialLinksRow`, `ServicesSection`, `ImageGallery`, `ReviewsPlaceholder`, `SimilarListingsRow`, `MobileStickyCtaBar` | Full listing record, business page details, media attachments, services, city, saves count, claim status | No (save/share gated for save) | MVP   | SSR + `generateStaticParams`; ISR 1h; LocalBusiness JSON-LD; OG image per listing |
| For Business            | `/for-business`                        | Full-bleed hero     | Claim your page                                              | Add a new business                                    | `MarketingHero`, `HowItWorksSteps`, `ValuePropGrid`, `SocialProofBar`, `CtaBand`, `Footer`                                                                                                                                                    | Static content                                                                                           | No                             | MVP   | SEO-targeted at Black business owners; repeated CTA at each section break         |
| About                   | `/about`                               | Constrained content | —                                                            | —                                                     | `AboutHero`, `MissionBlock`, `OriginStoryBlock`, `TeamSection`, `Footer`                                                                                                                                                                      | Static content                                                                                           | No                             | MVP   | Standard marketing page; no dynamic data                                          |

---

### Homepage (`/`) — Detailed Spec

The homepage is the most important screen in the product. It is the national front door — the first impression for every new visitor from Google, social media, and word of mouth. Every element is either driving discovery, driving business acquisition, or building trust in the platform's cultural purpose.

**What the user sees on arrival.** The viewport is filled by a hero section. The navigation bar floats transparently over it — wordmark left, discovery links center, Sign In + Sign Up (Amber Gold button) right. The hero contains the platform headline in Glacial Indifference ("Find & Be Found."), a subheadline in Lato, and a full-width search bar with a city selector and an Amber Gold search submit button. Below the hero the background transitions to Cream (`#FCFAF4`) or Deep Background (`#19191E`) depending on the section.

**Visual hierarchy.** The primary focal point is the search bar. It is the single most important element on the page. Everything above it (headline, subheadline) is frame; everything below it is discovery architecture. A user's eye lands on the search bar within two seconds of arrival.

**Category grid.** Five categories are rendered as icon + label tiles in a horizontal grid: Products & Services, Professionals, Creatives, Events, Jobs. Each links to the relevant discovery route. Icons use brand-appropriate illustration or line art. On mobile, the grid scrolls horizontally or wraps to two rows — it does not stack into a single column list.

**City spotlight.** Atlanta is the featured city at launch. The section headline reads "In Atlanta" (or "Explore Atlanta") followed by a curated grid of 4–6 listing cards (admin-selected in `/admin/collections`). Below Atlanta, Houston and Chicago appear as teaser rows: a city name, a single line of listing count data ("50+ businesses"), and a "Explore Houston →" link. These teaser rows are admin-controlled copy — no dynamic listing cards at MVP, just the count and the city link.

**Featured collection slot.** One admin-selected collection appears as a wide card with cover image, collection title, member count, and a short editorial excerpt. The CTA is an Amber Gold text link with arrow: "Explore [Collection Name] →". This slot is controlled by an admin flag on the `collections` table; if no collection is flagged as homepage-featured, the slot is hidden entirely — no empty state.

**Dollar-flow teaser.** A horizontally full-width band with a static illustration (network of connected nodes — designed asset, not live data) and the copy line: "Your receipts are already counting." Below the copy, an Amber Gold button: "Upload a receipt →" routes to `/account/receipts` for authenticated users or to `/sign-up?next=/account/receipts` for unauthenticated visitors. This band exists at MVP as intent-seeding and user research signal, not as a live data visualization.

**For Business CTA strip.** A full-width band in Brand Black or Deep Background with the headline "You deserve a better page." Two buttons side by side: "Claim Yours Free →" (Amber Gold) and "Add Your Business" (ghost/outline). This band appears below the city spotlight, above the footer.

**Footer.** Full platform footer per `navigation-model.md` — four columns, tagline, social links, legal row.

**Conditional rendering by auth state.** The nav reflects the user's auth state (anonymous → Sign In + Sign Up; authenticated supporter → avatar dropdown; authenticated owner → avatar dropdown with My Dashboard). The save button on featured listing cards is visible to all; unauthenticated users who tap save are prompted to sign in via a modal (not a redirect). The dollar-flow teaser CTA routes to sign-up if the user is unauthenticated.

**State management.** No `useState` on this page. Featured listings section is wrapped in `<Suspense>` with a skeleton — 4–6 `ListingCardSkeleton` components — so the hero, category grid, and city spotlight render immediately on first paint while featured listings stream in. City spotlight card data is fetched in a Server Component (`Promise.all` with featured collection in parallel). The homepage search bar is a Client Component (inline expansion + city selector state).

---

### Discover Page (`/discover`)

The discover page is the browsing-intent entry point for users who have not formed a specific keyword query. It is the complement to `/search`: search is query-driven, discover is facet-driven.

**What the user sees on arrival.** The full page is a filter bar + listing card grid. There is no hero. The top of the page content area (below the sticky nav) shows the platform's current total listing count and a filter bar with three selector controls: Entity Type, Category, and City. Below the filter bar, listing cards fill a responsive grid (3 columns desktop, 2 tablet, 1 mobile). Default state: all entity types, all categories, all cities, sorted by newest first.

**Visual hierarchy.** The filter bar is the primary focal point — it communicates "you are in control of what you see here." Each active filter value is shown in the filter control itself (not as a separate chip row). A result count ("142 businesses") appears to the left of the filter bar.

**Filter state.** All three filter values live in the URL as search params (`?type=business&category=restaurants&city=atlanta`). The filter bar is a Client Component that reads from `useSearchParams` and writes with `useRouter`. Changing any filter immediately updates the URL and triggers a new server data fetch — no submit button.

**Empty state.** When the active filters return zero results: heading "Nothing here yet" with the active filter labels listed, body copy suggesting broadening the search, and a "Clear all filters" Amber Gold button. No listing skeleton is shown on empty state — just the message.

**Pagination.** Load more button at the bottom of the grid (not infinite scroll at MVP). Each page loads 24 cards. The load more button shows the remaining count ("Load 24 more (18 remaining)").

---

### Search Results Page (`/search`)

Search is the highest-frequency workflow on the platform. The page must be fast, clear about what was searched, and honest about what was found.

**What the user sees on arrival.** The search bar at the top of the content area is pre-filled with the current query string. Below it, an active filter chip row shows any applied category or city filters with a remove (×) on each chip, plus a "Clear all" link when more than one filter is active. Below the chips, a result count + sort control in a single row: "142 results in Atlanta · Sort: Relevance" (sort is a `<Select>` — Relevance is the only option at MVP, so the control is present but non-functional visually at MVP; V1 adds Newest and Rating options). The listing cards fill the grid below.

**Listing card anatomy.** Cover image (16:9 or 1:1 — consistent across all cards in a grid), business name in Glacial Indifference, category badge, city text, Claimed/Unclaimed trust badge, save button (bookmark icon) in the top-right corner of the card. The entire card is a click target that navigates to the BLACQList Page.

**Empty state — zero results.** Heading: "No results for '[query]'." Body: "Try different keywords, or browse by category." Three suggestion links: "Browse all in Atlanta" → `/city/atlanta`, "Browse [matched category]" → `/discover?category=[slug]` (shown only if the query matches a category name), "Clear all filters" → `/search`. The original query is preserved in the search bar — the user is never left staring at a blank input.

**Empty state — no query.** When `/search` is visited with no `q` param, the page shows a prominent search bar with placeholder text, no filter chips, and a row of suggested category shortcut links: "Restaurants", "Hair & Beauty", "Wellness", "Professionals", "Creatives". These link to `/discover?category=[slug]`.

**Conditional rendering by auth state.** The save button on each card is visible to all users. Unauthenticated users who tap it see a sign-in prompt modal (not a redirect). Authenticated users toggle save state with optimistic UI — the bookmark icon fills immediately; the server action confirms in the background.

---

### City Landing Page (`/city/[city-slug]`)

The city landing page is a locally-scoped discovery surface and an SEO asset. It exists to capture "Black-owned businesses in [city]" search intent from Google and to give in-platform browsers a structured entry point into a specific city.

**What the user sees on arrival.** A city hero section with the city name in Glacial Indifference, a listing count ("150+ Black-owned businesses"), and a category shortcut pill row. Below the hero, a featured listings grid (8–12 cards, admin-curated or highest-engagement listings for that city). Below the grid, a city statistics line ("Across 12 categories — from restaurants to law firms") and a "View all in Atlanta →" link to `/search?city=atlanta`.

**Category shortcuts.** A horizontal row of category pills below the city name in the hero — each links to `/city/[city-slug]/[category-slug]`. At MVP, the top 5–6 categories for that city are shown (based on listing count).

**Conditional rendering.** If a city has fewer than 10 published listings, a note replaces the featured listings grid: "We're building out [City]. Be the first to claim your page here." with a "Claim Your Page" Amber Gold link. This edge case is relevant for Houston and Chicago at launch.

---

### City + Category Page (`/city/[city-slug]/[category-slug]`)

A scoped listing grid for a specific city-category combination. This is the most SEO-valuable page type on the platform — it directly targets high-intent transactional queries like "Black-owned hair salons Atlanta."

**What the user sees on arrival.** The page opens with an SEO-purpose title block: "[Category] in [City]" as an `h1`, a listing count, and a single-line description if editorial copy exists for this combination. Below that, a filter bar with a sort control (Relevance only at MVP) and an optional subcategory filter (deferred to V1). The listing card grid fills below.

**Conditional rendering.** If the city + category combination has zero published listings: the page renders with the title block and an empty state: "No [category] listings in [City] yet." with a "Add your business" CTA. The page should still be indexed — the combination may have listings in the future and SEO value in being established.

---

### Business BLACQList Page (`/[city-slug]/business/[listing-slug]`) — Detailed Spec

The BLACQList Page is the atomic unit of the platform. It is the product promise made tangible. It must look better than a Google Business Profile, more complete than a Yelp listing, and more purposeful than an Instagram bio. This is the most complex screen in the MVP.

**What the user sees on arrival.** The navigation bar overlays the hero image transparently, transitioning to solid Deep Background on scroll past the hero. The hero section occupies the full viewport width, up to 60% viewport height on desktop. The cover image fills the hero area as an object-fit cover. Overlaid on the lower portion of the hero: the business name in Glacial Indifference (white on the dark image), the tagline in Lato below it, and — in the lower-right corner — the trust badge (Unclaimed in Pale Lavender / Claimed in Amber Gold). The primary CTA button (Amber Gold, `px-8 py-3`, with the owner-configured label: Book, Order, Call, Visit, or Message) appears in the hero, adjacent to or below the business name. The save button (bookmark icon, Cream) and share button (share icon, Cream) appear as icon buttons to the right of the primary CTA on desktop, below it on mobile.

**Visual hierarchy.** The cover image and business name are the focal point. The primary CTA is the action. Everything below the hero is information that supports the action. The reading order is: hero → who are they → what do they do → how do I reach them → what do they look like (gallery) → what others say (reviews placeholder).

**About section.** The business description text, set in Quicksand or Lato, below a short horizontal rule. No character limit enforced in the UI (admin can set a soft limit). Truncated at 4 lines with an expand "Read more" affordance if the text exceeds the collapsed height.

**Category + subcategory tags.** A row of badge-style tags below the About section. Primary category in Amber Gold badge style; subcategory tags in Pale Lavender badge style.

**Hours of operation.** A card showing the open/closed status (green "Open now" or red "Closed" with the next opening time), and the full weekly schedule in a compact two-column list. The open/closed indicator is calculated client-side based on the current time and the stored hours object — this is the only piece of client-side time logic on the page.

**Contact block.** Phone, email, website, and address/map pin rendered as a card with icon + value rows. Phone is a `tel:` link. Email is a `mailto:` link. Website opens in a new tab. Address shows as text with a map pin icon — on tap/click, opens a maps link (Google Maps or Apple Maps based on OS detection). For service-area businesses, "Service area: [City name]" replaces the address.

**Social links row.** Up to five icon buttons: Instagram, Facebook, LinkedIn, TikTok, YouTube. Only icons with a corresponding non-empty link in the listing data are rendered. Icon style: circle outline, Charcoal background on hover, Cream icon. Each opens in a new tab.

**Services / offerings list.** A clean list: service name in Lato Medium, optional description in smaller Lato Regular, optional price in Amber Gold. Up to 20 services at MVP. If more exist, they are paginated or a "View all services" expansion is used. This section is collapsible on mobile to reduce scroll depth.

**Gallery.** A masonry or uniform grid of up to 12 images (3-column grid desktop, 2-column tablet, 2-column mobile). Each image opens a lightbox on click/tap. The lightbox supports left/right navigation between gallery images, swipe on mobile, and Escape to close. If fewer than 3 images exist, the gallery renders a narrower single-row layout. If no images exist, the gallery section is hidden entirely — no "Upload photos" empty state is shown on the public page (that prompt is in the owner dashboard).

**Reviews placeholder (MVP).** At MVP, reviews are not published. The section renders: "Reviews coming soon. Be part of the first wave." with a note about when reviews will be available. If any review submissions have been collected (even unpublished), the section shows "X reviews submitted — watch this space." The actual count is a Supabase aggregation on the reviews table filtered by listing_id.

**Similar listings row.** Three to four listing cards in a horizontal scroll row on mobile (snapping scroll), horizontal grid on desktop. Title: "More [Category] in [City]". Cards are fetched based on category + city match, excluding the current listing, ranked by admin curation or save count. If fewer than 3 similar listings exist, the section is hidden.

**Mobile sticky CTA bar.** A fixed full-width bar pinned to the bottom of the viewport (56px height, Amber Gold background, Brand Black text) containing the same primary CTA label as the hero button. Behavior: hidden while the hero CTA button is in the viewport; visible as soon as the hero scrolls out; hidden again when the user scrolls to the contact block at the bottom. This bar is a Client Component tracking scroll position via `useEffect + IntersectionObserver`.

**Conditional rendering by auth state.** The save button state is loaded optimistically: anonymous users see an unfilled bookmark; authenticated users see their save state (filled if saved). Tapping save while anonymous opens a sign-in prompt modal over the current page — no redirect. Tapping save while authenticated triggers a `POST /api/saves` call with optimistic UI.

**SEO.** Every page has a unique `<title>` ("[Business Name] — [Category] in [City] | The BLACQList"), a `<meta name="description">`, and `schema.org/LocalBusiness` JSON-LD. OG image is generated per listing via the `/og/[...params]` API route. Canonical URL is set to the definitive slug path.

---

### For Business Page (`/for-business`)

Marketing page targeting Black business owners who want to establish or improve their digital presence.

**What the user sees on arrival.** A hero section with the headline "You deserve a better page." (Glacial Indifference, large), a subheadline explaining the BLACQList Page value proposition in two sentences, and two buttons side by side: "Claim Your Page" (Amber Gold) and "Add Your Business" (ghost). Below the hero, the page follows a three-act structure: (1) value proposition grid — three feature blocks with icons ("Polished by default", "Found by your community", "Trusted with a badge"), (2) how-it-works — three numbered steps with short copy (Claim or Create → Complete Your Page → Get Found), and (3) a final CTA band repeating the Claim button. A social proof line (listing count or city count) appears between the hero and the value grid.

**No dynamic data.** This is a fully static Server Component. The only external data it references is the platform listing count — fetched at build time and revalidated weekly, acceptable to be slightly stale.

---

### About Page (`/about`)

Static marketing page. Mission statement, origin story, team section (names, titles, photos or initials placeholders), and a single Amber Gold CTA at the bottom: "Discover The BLACQList →" → `/discover`. No dynamic data. Full footer.

---

## 2. Auth Screens

### Table

| Screen          | Route              | Layout          | Primary Action                | Secondary Actions              | Key Components                                                                                        | Data Required     | Auth                    | Phase | Notes                                                          |
| --------------- | ------------------ | --------------- | ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------- | ----------------------- | ----- | -------------------------------------------------------------- |
| Sign In         | `/sign-in`         | Auth centered   | Sign in with email + password | Forgot password, go to sign-up | `SignInForm`, `ForgotPasswordLink`, `SignUpLink`, `AuthErrorAlert`                                    | —                 | No (redirect if authed) | MVP   | Supabase Auth; redirect to `?next=` or `/dashboard` on success |
| Sign Up         | `/sign-up`         | Auth centered   | Create account                | Go to sign in, terms link      | `SignUpForm` (email, password, display name, role selector, ToS checkbox), `SignInLink`               | —                 | No (redirect if authed) | MVP   | Triggers email verification; role default: Supporter           |
| Onboarding      | `/onboarding`      | Multi-step form | Complete onboarding step      | Skip, go back                  | `OnboardingStepIndicator`, `RoleConfirmStep`, `BusinessSearchStep`, `ExplorePromptStep`, `SkipButton` | User record, role | Yes                     | MVP   | 2–3 steps max; Client Component for step state; skippable      |
| Forgot Password | `/forgot-password` | Auth centered   | Send reset link               | Back to sign in                | `ForgotPasswordForm`, `BackToSignInLink`, `SuccessMessage`                                            | —                 | No                      | MVP   | Always shows success regardless of whether email exists        |
| Reset Password  | `/reset-password`  | Auth centered   | Set new password              | Back to sign in                | `ResetPasswordForm` (new password, confirm), `ExpiredTokenError`, `BackToSignInLink`                  | Token from URL    | No (token-gated)        | MVP   | Supabase handles token validation                              |
| Verify Email    | `/verify-email`    | Auth centered   | — (landing page)              | Resend verification email      | `VerifySuccessMessage`, `VerifyErrorState`, `ResendEmailButton`, `RedirectCountdown`                  | Token from URL    | No (token-gated)        | MVP   | Success → redirect to `/onboarding`; failure → resend option   |

---

### Sign In (`/sign-in`)

**What the user sees on arrival.** A centered card (max-w-sm, Cream background or Deep Background card on Cream page) with the BLACQList wordmark at the top, a "Welcome back." heading, the email input field, the password input field with a show/hide toggle, and the "Sign In" Amber Gold full-width button. Below the button: "Forgot your password?" as a text link (routes to `/forgot-password`). Below that, a thin divider and "Don't have an account? Sign up →" text link to `/sign-up`.

**Error handling.** If Supabase Auth returns an error (wrong password, user not found, unverified email), an inline `AuthErrorAlert` appears above the form fields — red background, specific message. The form is not cleared on error. The password field retains no value (browser-managed), but the email field retains the user's typed value so they do not have to retype it.

**Conditional redirect.** If the user is already authenticated on arrival, the page immediately redirects to `/dashboard` for owners or `/account/saved` for supporters. Middleware handles this before the page renders — there is no flash of the sign-in form for authenticated users.

---

### Sign Up (`/sign-up`)

**What the user sees on arrival.** Same centered card layout as sign-in. Heading: "Create your account." Fields: Display Name (text), Email (email), Password (password with show/hide). Below the password field, a role selector rendered as two option cards side by side: "I'm a supporter" (bookmark icon, "Discover and save Black-owned businesses") and "I own a business" (storefront icon, "Create or claim my BLACQList Page"). The supporter role is pre-selected by default. Below the role selector, a checkbox: "I agree to the Terms of Service and Privacy Policy" with embedded links. The "Create Account" Amber Gold full-width button below. Below the button, "Already have an account? Sign in →".

**After submission.** The form shows an inline success state (no redirect): "Check your email. We sent a verification link to [email]." with a "Resend email" text link. The account exists in Supabase Auth but the user cannot fully access authenticated routes until the email is verified.

---

### Onboarding (`/onboarding`)

**What the user sees on arrival.** A minimal layout — no full nav, no footer — with the BLACQList wordmark at the top and a step progress indicator below it (three dots or a step count: "Step 1 of 3"). The content area renders one step at a time.

**Step 1 — Role + Intent.** Heading: "Welcome. Let's get you set up." The user's role (already set at sign-up) is shown and can be confirmed or changed here. If they selected "I own a business" at sign-up, this step confirms: "You're set up as a Business Owner. Ready to find or create your page?" Two buttons: "Find my business →" (advances to Step 2A) and "Add a new business →" (advances to Step 2B). If they selected Supporter, this step shows: "You're set up as a supporter. Ready to explore?" One button: "Start exploring →" (advances to Step 3).

**Step 2A — Search for your business.** An inline search bar with city selector. Results render below as listing preview cards. Selecting a card shows a "Claim this listing?" confirmation prompt with the listing name and city. Confirming routes to `/claim/[listing-id]`. "I don't see my business" link below results advances to Step 2B.

**Step 2B — Add a new business.** Heading: "Let's create your BLACQList Page." A brief copy block explaining the multi-step form. One Amber Gold button: "Start building your page →" routes to `/add-business`.

**Step 3 — Explore prompt.** Heading: "You're all set." For supporters: "Start by browsing near you." Three suggested category links in Amber Gold-outline pill style. For business owners completing step 2: "Your page is on its way. While you wait, explore the platform." with a single "Explore The BLACQList →" link.

**Skip behavior.** A "Skip for now" text link appears in the upper-right of every step. Clicking it redirects to `/discover` for supporters or `/dashboard` for owners. Onboarding is marked complete in the user record either when the flow finishes or when the user skips.

---

## 3. Account Screens (Supporter)

### Table

| Screen              | Route               | Layout            | Primary Action                   | Secondary Actions                           | Key Components                                                                             | Data Required                                                                   | Auth | Phase      | Notes                                                                   |
| ------------------- | ------------------- | ----------------- | -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ---- | ---------- | ----------------------------------------------------------------------- |
| Saved Listings      | `/account/saved`    | Dashboard sidebar | Navigate to a saved listing Page | Unsave a listing, browse discover           | `SavedListingsGrid`, `SaveToggleButton`, `EmptyState`, `LoadMoreButton`                    | `saves` for `auth.uid()`, listing records (name, image, category, city, status) | Yes  | MVP        | Save/unsave toggle from this page; optimistic UI                        |
| Receipt Upload Beta | `/account/receipts` | Dashboard sidebar | Upload a receipt                 | View submitted receipts, correct OCR fields | `ReceiptUploadButton`, `ReceiptList`, `ReceiptOCRForm`, `ReceiptStatusBadge`, `EmptyState` | `spend_events` for `auth.uid()`                                                 | Yes  | MVP (Beta) | OCR is a manual-entry stub at MVP; beta flag in UI copy                 |
| Account Settings    | `/account/settings` | Dashboard sidebar | Save profile changes             | Change password, delete account             | `ProfileForm`, `SecuritySection`, `DeleteAccountSection`, `ConfirmationDialog`             | User record for `auth.uid()`                                                    | Yes  | MVP        | Separate form sections; destructive actions require dialog confirmation |

---

### Saved Listings (`/account/saved`)

**What the user sees on arrival.** The dashboard sidebar nav (Home, Search, Saved [active], Account) is present on desktop; the bottom nav bar reflects the same on mobile. The main content area shows a "Saved" page heading with a count badge ("12 saved"). Below, a grid of listing cards identical in format to search result cards but with a filled bookmark icon indicating saved state. Clicking the bookmark icon on any card unsaves it with optimistic UI (the card either immediately removes from the grid or transitions to an unsaved visual state with a brief toast confirmation: "Removed from saved.").

**Empty state.** Heading: "Nothing saved yet." Body: "When you find a business worth coming back to, save it here. It takes one tap." Two CTAs: "Browse Businesses" (Amber Gold button → `/discover`) and "Search for something specific" (text link → `/search`). The empty state replaces the card grid — no skeleton is shown in the empty state.

**Pagination.** Load More button below the grid (24 cards per page). If all saves fit on one page, the Load More button is hidden.

---

### Receipt Upload Beta (`/account/receipts`)

**What the user sees on arrival.** A page heading "My Receipts" with a beta badge ("Beta"). A brief explanatory paragraph: "Upload receipts from Black-owned businesses. We'll track your community spend — and yours." An Amber Gold "Upload Receipt" button opens either the device camera (`capture="environment"` on mobile) or a file picker. Below the upload button, a list of previously uploaded receipts (business name, amount, date, status badge: Pending / Reviewed / Flagged). Each receipt row has an expand action to see full OCR-suggested fields.

**After upload.** The receipt image is submitted to `/api/receipts`. A modal appears showing the OCR confirmation form: business name (text, pre-filled from OCR or blank), amount (number), date (date picker, defaulting to today). The user can correct any pre-filled values. A "Submit" Amber Gold button submits the corrected data. A "Skip" link closes the modal without submitting corrections (the raw image is still stored).

**Empty state.** Heading: "No receipts uploaded yet." Body: "Start by uploading your first receipt. Every dollar counts." Amber Gold "Upload Your First Receipt" button.

---

### Account Settings (`/account/settings`)

**What the user sees on arrival.** A "Settings" page heading. The content is organized into three distinct sections separated by dividers:

**Profile section.** Display Name field (text input), Email field (text input, read-only — email changes require a confirmation flow deferred to V1). A "Save changes" Amber Gold button below the profile fields.

**Security section.** A "Change Password" row with a right-pointing chevron or inline expand that reveals Current Password + New Password + Confirm Password fields and a "Update Password" button. If the user signed up via OAuth (V1), this section shows a note that password change is managed through the OAuth provider.

**Delete account section.** Visually separated in a danger zone card (red-outlined or red-background-tint card). Copy: "Permanently delete your account. This action cannot be undone." A "Delete Account" button in the destructive variant (red). Clicking opens a confirmation dialog: "Are you sure? Enter your email address to confirm." — requires the user to type their email exactly before the confirm button becomes enabled.

---

## 4. Claim + Create Screens

### Table

| Screen       | Route                 | Layout              | Primary Action          | Secondary Actions                      | Key Components                                                                                                                                                            | Data Required                   | Auth | Phase | Notes                                                                                |
| ------------ | --------------------- | ------------------- | ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------ |
| Claim Entry  | `/claim`              | Constrained content | Search for your listing | Add a new business, sign in            | `ClaimSearchBar`, `ClaimResultsList`, `AddBusinessLink`, `SignInPrompt`                                                                                                   | Search results from listing API | Yes  | MVP   | Auth gate: unauthenticated users see a sign-in prompt before searching               |
| Claim Form   | `/claim/[listing-id]` | Constrained content | Submit claim request    | Back to claim search, not this listing | `ListingClaimPreviewCard`, `ClaimVerificationForm`, `DocumentUploadField`, `SubmitClaimButton`, `NotMyListingLink`                                                        | Listing record by ID            | Yes  | MVP   | Creates a claim record with `status: pending`; triggers claim submitted email        |
| Add Business | `/add-business`       | Multi-step form     | Continue to next step   | Back, save draft (local)               | `StepProgressBar`, `EntityTypeStep`, `BasicInfoStep`, `ContactStep`, `CategoryCityStep`, `MediaStep`, `CtaStep`, `PreviewStep`, `PublishButton`, `DuplicateWarningDialog` | Category list, city list        | Yes  | MVP   | 7 steps; URL param or localStorage draft persistence; duplicate check before publish |

---

### Claim Entry (`/claim`)

**What the user sees on arrival.** A clean, focused layout with the BLACQList logo at the top (no full nav — this is a task-focused flow), a heading "Claim your BLACQList Page", and a subheadline: "Search for your business to see if it's already listed." Below, a search bar with a city selector (same component pattern as the homepage hero, but smaller). As the user types, results appear below the search bar as listing preview cards (name, city, category, current claim status — Unclaimed, Claimed, Pending). Each result card has a "Claim this listing" button that navigates to `/claim/[listing-id]`.

**Not listed state.** Below the search results (or immediately if no results returned), a link: "I don't see my business here" → `/add-business`. This ensures the flow never dead-ends.

**Auth gate.** If the user arrives unauthenticated, the search bar is visible but attempting to search or click a claim button triggers a sign-in modal. After sign-in, they are returned to `/claim` with their session active.

---

### Claim Form (`/claim/[listing-id]`)

**What the user sees on arrival.** A card at the top showing the listing being claimed: cover image thumbnail, business name, city, category, and current status badge. Below the card, a "Not this listing? Go back →" link. Below that, the claim verification form.

**Claim verification form.** Three fields: Business Email (text, required — "The email address associated with this business"), Business Phone (tel, required), and an optional document upload field ("Upload proof of ownership — government business license, utility bill, or website screenshot. Optional but speeds up review."). Below the fields, a "Submit Claim" Amber Gold full-width button.

**Confirmation state.** After successful form submission, the page transitions to an inline confirmation state (no redirect): a green checkmark icon, heading "Claim submitted.", body copy "We'll review your claim within 48 hours and notify you at [user's email]. In the meantime, your listing page is available for visitors." Two links: "View your listing →" (to the public BLACQList Page) and "Return to homepage →".

---

### Add Business — Multi-Step Create (`/add-business`)

**What the user sees on arrival.** A minimal layout with the BLACQList logo, a step progress bar showing 7 steps with the current step highlighted (Amber Gold), and the current step's form panel. "Back" and "Continue" buttons are fixed at the bottom of the form panel.

**Step 1 — Entity Type.** Heading: "What type of page are you creating?" Four option cards: Business, Professional, Creative, Event/Pop-up. At MVP, Professional, Creative, and Event are shown with a "Coming soon" label — only Business advances the flow. This sets expectations about the roadmap without blocking anyone.

**Step 2 — Basic Info.** Business Name (text, required), Tagline (text, optional, max 80 characters), Business Description (textarea, required, min 50 characters, max 1000). Character count shown.

**Step 3 — Contact.** Phone (tel), Email (email), Website (url — includes `https://` placeholder prefix). Street Address with a toggle: "This business serves an area rather than a fixed location" — when toggled, address fields are replaced with "Service area description" text field.

**Step 4 — Category + City.** Category (required, searchable select from predefined list), Subcategory (optional, dependent on category selection — deferred in data at MVP), City (required, searchable select from seeded city list). A tags input for additional keywords is deferred to V1.

**Step 5 — Media.** Logo upload (single image, square crop recommended, max 2MB). Cover image upload (landscape, 16:9 recommended, max 5MB). Gallery images (up to 12, multiple file select or camera capture on mobile, max 2MB each). Each upload shows a preview after selection. "Skip for now" available for all media fields — the form is not blocked by missing media.

**Step 6 — Primary CTA.** Heading: "How do you want visitors to reach you?" Five option cards: Book an appointment (booking URL input), Order online (URL input), Call us (phone pre-filled from Step 3), Visit us (address pre-filled from Step 3), Message us (email or social link input). The selected option sets `cta_type` and `cta_value` on the listing record.

**Step 7 — Preview + Publish.** A read-only rendering of the BLACQList Page as it will appear publicly, using the data collected in Steps 1–6. A "Publish" Amber Gold button at the bottom. A "Save as draft" ghost button. Before publish, a duplicate detection check runs server-side: if a listing with a similar name in the same city exists, a `DuplicateWarningDialog` appears showing the potential match and asking: "Is this the same business?" → "Yes, take me to claim it" (routes to `/claim/[existing-id]`) or "No, continue publishing" (proceeds).

**Draft persistence.** Step progress is stored in `localStorage` under a draft key so that if the user navigates away and returns, their form state is restored. On successful publish, the draft key is cleared.

---

## 5. Owner Dashboard Screens

### Table

| Screen           | Route                 | Layout            | Primary Action       | Secondary Actions                              | Key Components                                                                                                                                                                    | Data Required                                                                                   | Auth        | Phase | Notes                                                                          |
| ---------------- | --------------------- | ----------------- | -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------- | ----- | ------------------------------------------------------------------------------ |
| Dashboard Home   | `/dashboard`          | Dashboard sidebar | Edit Page            | Preview Page, Share Page                       | `ClaimStatusBanner`, `PagePreviewCard`, `StatsRow`, `QuickActionsBar`, `CompletionChecklist`, `HelpPanel`                                                                         | Listing record, analytics event aggregates (7d: views, CTA clicks, saves, shares), claim status | Yes (Owner) | MVP   | Non-owners redirected to `/account`; empty state for new owners without a page |
| Page Editor      | `/dashboard/page`     | Dashboard sidebar | Save changes to Page | Preview Page, Publish/Unpublish toggle         | `PageEditorForm` (sectioned), `HeroSection`, `AboutSection`, `ContactSection`, `HoursSection`, `SocialSection`, `CTASection`, `PublishToggle`, `AutosaveIndicator`, `PreviewLink` | Full listing record, business page details, media attachments                                   | Yes (Owner) | MVP   | `react-hook-form` + `zod`; autosave on section blur; large multi-section form  |
| Services Manager | `/dashboard/services` | Dashboard sidebar | Add a new service    | Edit service, delete service, reorder services | `ServicesList`, `AddServiceForm`, `ServiceEditRow`, `DeleteServiceConfirmDialog`, `DragToReorderHandle`                                                                           | Services for listing_id                                                                         | Yes (Owner) | MVP   | Inline or modal form for add/edit; drag-to-reorder updates `sort_order` field  |

---

### Dashboard Home (`/dashboard`)

**What the user sees on arrival.** The dashboard sidebar is on the left (desktop) with nav items: Overview (active), My Page, Services, Settings. The main content area starts with a claim status banner.

**Claim status banner.** A top-of-page full-width contextual banner that changes by claim state: (1) Unclaimed — Amber Gold background, "Your claim is pending review. We'll email you at [email] within 48 hours." (2) Approved — no banner (the user is operational). (3) New page, no claim needed — no banner.

**Page preview card.** A card showing the listing's cover image thumbnail (left), business name (right), city and category text below the name, a "View live page →" link, and a small publish status badge (Published / Draft).

**Stats row.** Four metric cards in a horizontal row: Page Views (7d), CTA Clicks (7d), Saves (7d), Shares (7d). Each card shows: metric label, the count in large Glacial Indifference numerals, and a trend indicator (no trend comparison at MVP — just the count). If the page is unpublished or has been live less than 7 days, the count shows `—` and a note "Stats begin once your page is published."

**Quick actions bar.** Three ghost or secondary buttons in a row: "Edit My Page" → `/dashboard/page`, "Preview Page" → opens the public BLACQList Page URL in a new tab, "Share Page" → opens a share sheet or copy-link modal.

**Completion checklist.** A section below the stats row titled "Complete your page" showing a progress bar ("3 of 5 steps complete") and a checklist:

1. Add your description — checkmark if `description` is non-empty
2. Upload a cover image — checkmark if cover image exists
3. Set your primary CTA — checkmark if `cta_type` is set
4. Add your hours — checkmark if hours are non-empty
5. Add at least one service — checkmark if `services` count > 0

Each unchecked item is a link to the relevant section of the page editor. The checklist is hidden once all five steps are complete and the page has been published for 7+ days.

**Empty state — new owner, no page.** If the owner has no listing associated with their account (e.g., they arrived via sign-up but skipped onboarding), the entire main content area shows: heading "Create your BLACQList Page", body "Let's get you found." Two Amber Gold buttons: "Search for my business to claim" → `/claim` and "Create a new page" → `/add-business`.

---

### Page Editor (`/dashboard/page`)

**What the user sees on arrival.** The main content area shows a large multi-section form. The form is organized as collapsible sections (accordion-style on mobile, visible all sections stacked on desktop): Hero, About, Location + Hours, Contact, Social Links, Services (link to `/dashboard/services`), Gallery, Primary CTA, and Publish Settings. A sticky "Preview" button in the top-right of the content area opens the public-facing BLACQList Page in a new tab using the current saved state.

**Hero section.** Business Name (text input, required), Tagline (text, optional). Cover Image upload (replaces existing on upload; preview shown). The current cover image renders as a preview card.

**About section.** Business Description (textarea, required, character count shown). No rich text at MVP — plain text only.

**Location + Hours section.** Address fields (or service area toggle). Day-by-day hours with open/closed toggles for each day.

**Contact section.** Phone, Email, Website — same fields as the add-business Step 3 form, reused.

**Social Links section.** Six URL input fields: Instagram, Facebook, LinkedIn, TikTok, YouTube, custom link (one additional). Each has a platform icon to the left of the input.

**Gallery section.** Grid display of uploaded images with a drag-to-reorder interface. Add images button (multi-select or camera). Delete button on each image (with undo toast). Image count indicator: "6 / 12 photos".

**Primary CTA section.** The same five-option cards from the add-business Step 6 form. Currently selected option is highlighted. Changing the selection updates `cta_type`; the associated input field updates accordingly.

**Publish settings section.** A toggle: "Published / Draft". When Draft, a note: "Your page is not visible to the public." When Published, a note: "Your page is live." Toggling triggers a confirmation dialog on both Publish (first time) and Unpublish.

**Autosave.** On blur of each section, a `useDebouncedCallback` fires a server action to save the current section's fields. An `AutosaveIndicator` in the top-right shows: "Saved" (with timestamp), "Saving…", or "Unsaved changes." Navigating away with unsaved changes triggers a browser-level `beforeunload` warning.

**Form validation.** `react-hook-form` with `zod` resolver. Required fields (Name, Description) are validated on section-level save. Non-required fields are saved regardless of completeness. Field-level error messages appear inline below each input.

---

### Services Manager (`/dashboard/services`)

**What the user sees on arrival.** A "Services" heading with a count badge ("4 services"). Below, a "Add a Service" Amber Gold button. Below that, a list of existing services as drag-reorderable rows. Each row shows: drag handle, service name, optional price, edit icon, delete icon.

**Add / Edit form.** Opens in a modal (or inline expansion below the add button): Service Name (text, required), Description (textarea, optional), Price (text, optional — free-form: "From $50", "$50/hr", "Contact for pricing"). Save and Cancel buttons.

**Delete.** Clicking the delete icon on a service opens a confirmation dialog: "Delete [Service Name]? This will remove it from your BLACQList Page." Confirm deletes; Cancel dismisses.

**Reorder.** Drag-to-reorder using the drag handle. On drop, a server action fires to update the `sort_order` field for all affected service records. Optimistic UI — the order updates immediately on drop.

---

## 6. Admin Screens

### Table

| Screen                | Route                     | Layout      | Primary Action          | Secondary Actions                             | Key Components                                                                                                                                           | Data Required                                                                   | Auth        | Phase      | Notes                                                                                            |
| --------------------- | ------------------------- | ----------- | ----------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Admin Overview        | `/admin`                  | Admin panel | Navigate to claim queue | Navigate to listings, users                   | `PlatformStatsRow`, `ActionQueueLinks`, `RecentActivityFeed`                                                                                             | Platform aggregates: listing count, pending claims, new users (7d), total saves | Yes (Admin) | MVP        | Redirects to `/admin/overview`; no content at root                                               |
| Admin Listings        | `/admin/listings`         | Admin panel | Edit a listing          | Filter, search, bulk flag, delete             | `ListingsTable`, `StatusFilterChips`, `SearchInput`, `BulkActionBar`, `TableActionMenu`                                                                  | Paginated listings with claim status join, all filter dimensions                | Yes (Admin) | MVP        | Full CRUD; bulk flag action                                                                      |
| Admin Listing Detail  | `/admin/listings/[id]`    | Admin panel | Save listing changes    | Change status, flag listing, delete listing   | `AdminListingForm`, `StatusOverrideSelect`, `FlagReasonInput`, `ClaimHistoryPanel`, `DeleteConfirmDialog`                                                | Full listing record, business details, media, claim history                     | Yes (Admin) | MVP        | Same fields as owner editor; admin adds status override, flag, hard delete                       |
| Admin Claims Queue    | `/admin/claims`           | Admin panel | Approve a claim         | Reject a claim, filter by status              | `ClaimsTable`, `StatusFilter`, `ClaimRowActions` (approve/reject), `RejectReasonModal`                                                                   | All claims with listing + user join                                             | Yes (Admin) | MVP        | Claim cards with inline approve/reject; reject requires reason                                   |
| Admin Claim Review    | `/admin/claims/[id]`      | Admin panel | Approve claim           | Reject with reason                            | `ClaimDetailPanel` (claimant info, verification data, document preview), `LinkedListingPreview`, `ClaimantProfileLink`, `ApproveButton`, `RejectPanel`   | Claim record, linked listing, user record, uploaded verification docs           | Yes (Admin) | MVP        | Approve triggers owner role + email; reject triggers email with reason                           |
| Admin Receipts Queue  | `/admin/receipts`         | Admin panel | Mark receipt reviewed   | Flag for correction                           | `ReceiptsTable`, `ReceiptDetailPanel`, `OCRCorrectionForm`, `StatusFilter`                                                                               | `spend_events` with `status = pending_review`; receipt image from Storage       | Yes (Admin) | MVP (Beta) | Beta intake only; admin corrects OCR values and approves                                         |
| Admin Collections     | `/admin/collections`      | Admin panel | Create new collection   | Edit, archive, publish/unpublish              | `CollectionsTable`, `CollectionRow` (edit/archive/publish toggle), `CreateCollectionButton`                                                              | All collections with listing count                                              | Yes (Admin) | MVP        | Collections drive homepage featured slot and `/collections` page                                 |
| Admin Collection Edit | `/admin/collections/[id]` | Admin panel | Save collection changes | Add listing, remove listing, reorder, publish | `CollectionMetadataForm` (title, slug, description, cover image), `ListingSearchAndAdd`, `SelectedListingsTable`, `DragToReorderHandle`, `PublishToggle` | Collection record, linked listing records                                       | Yes (Admin) | MVP        | Search to add listings; drag to reorder; publish/unpublish                                       |
| Admin Users           | `/admin/users`            | Admin panel | Change user role        | Suspend/unsuspend user, filter by role        | `UsersTable`, `RoleFilter`, `UserRowActions` (change role, suspend), `RoleChangeConfirmDialog`, `SuspendConfirmDialog`                                   | Users table, user_roles table                                                   | Yes (Admin) | MVP        | Role change and suspend require confirmation dialogs; Super Admin only for Admin role assignment |

---

### Admin Overview (`/admin`)

**What the user sees on arrival.** The admin sidebar is on the left (240px, Brand Black background) with the BLACQList wordmark and "Admin" badge in Amber Gold at the top. Nav items at MVP: Overview (active), Listings, Claims, Collections, Users. V1 items (Verification, Reviews, etc.) are visible but show "Coming in V1" on click.

**Platform stats row.** Five stat cards: Total Listings, Active Listings, Pending Claims, New This Week, Total Users. All are Server Component data fetches from Supabase aggregation queries.

**Action queue links.** A section titled "Needs attention" with linked rows showing live queue counts: "Claims pending review: [N]" → `/admin/claims`, "Listings flagged: [N]" → `/admin/listings?status=flagged`. These are the admin's daily to-do list. If all counts are zero, the section shows "All caught up." with a subtle checkmark.

**Recent activity feed.** The last 10 platform events in reverse chronological order: new listing created (with name + city), claim submitted (with claimant name + listing name), new user registered. Each event row has a timestamp and a link to the relevant detail page.

---

### Admin Listings (`/admin/listings`)

**What the user sees on arrival.** A full-width data table. Above the table: a search input (searches by listing name), and filter chips for Status (All, Unclaimed, Claimed, Pending, Flagged, Draft), City (select), and Category (select). A "Bulk actions" dropdown appears when rows are selected (checkbox on each row): available bulk action is "Flag selected" (opens a reason input modal).

**Table columns.** Business Name (clickable → detail view), City, Category, Entity Type, Status badge, Claim Status badge, Created date, Actions menu (kebab: Edit, Flag, Delete).

**Pagination.** 50 rows per page with page controls at the bottom.

**Delete.** The delete action in the kebab menu opens a confirmation dialog: "Delete [Business Name]? This is permanent and cannot be undone." Requires the admin to click a red "Delete permanently" button. A destructive action toast confirms: "[Business Name] deleted."

---

### Admin Claims Queue (`/admin/claims`)

**What the user sees on arrival.** A table of claims filtered by Status chips at the top: All, Pending (default), Approved, Rejected. Table columns: Claimant Name, Listing Name, City, Submitted Date, Verification Type (email/phone/document), Status badge, Actions (Approve, Review). The Approve button is Amber Gold. The Review button navigates to `/admin/claims/[id]`.

**Inline approve.** For straightforward claims, admin can approve directly from the table row without visiting the detail page. Clicking Approve opens a confirmation tooltip/popover: "Approve [Name]'s claim for [Listing Name]?" with a confirm Approve button. Approval fires a server action that sets claim status to approved, assigns Owner role to the user, and triggers the email notification.

**Reject.** Reject is not available as an inline table action — the admin must visit the claim detail page to reject, because a rejection reason is required.

---

### Admin Claim Review (`/admin/claims/[id]`)

**What the user sees on arrival.** A two-column layout (desktop) or stacked (mobile). Left panel: the claim record details — claimant's display name, email, submitted date, and the verification data they provided (business email, phone, document if uploaded). If a document was uploaded, it renders as an inline image preview or a download link. Right panel: the listing being claimed — name, city, category, description, current status badge, and a "View live page →" link.

**Actions.** Below the two panels: an "Approve Claim" Amber Gold button (full-width or large, prominent). And a "Reject Claim" destructive button. Clicking Reject expands an inline panel: a `Textarea` labeled "Reason for rejection (sent to claimant)" and a "Confirm Rejection" red button. The reason is required before rejection fires. Both actions trigger email notifications.

**Breadcrumb.** `Admin / Claims / [Claimant Name]'s claim for [Listing Name]` — linked breadcrumb at the top of the page.

---

### Admin Collections (`/admin/collections`)

**What the user sees on arrival.** A table of all collections: Collection Name, Slug, Listing Count, Status (Published / Draft), Created Date, Homepage Featured flag (boolean badge), Actions (Edit, Archive). A "Create New Collection" Amber Gold button in the top-right of the page.

**Homepage featured flag.** Only one collection can have the homepage featured flag active at a time. Setting a new collection as featured automatically removes the flag from any previously featured collection. This is enforced by a server action check before update.

---

### Admin Collection Edit (`/admin/collections/[id]`)

**What the user sees on arrival.** A two-section layout. Top section: collection metadata form — Title (text), Slug (text, auto-generated from title but editable), Description (textarea), Cover Image (upload), Homepage Featured toggle (checkbox). A "Save metadata" button below.

**Bottom section: listing management.** A "Search to add listings" input that queries the listings table by name as the user types. Search results appear below as selectable rows (listing name, city, category). Clicking a result adds the listing to the collection. The current collection listings are rendered below as a drag-reorderable table (drag handle, listing name, city, category, remove button). Drag-to-reorder fires a server action on drop to update `sort_order`.

**Publish toggle.** A sticky footer bar or a top-of-page banner with a "Published / Draft" toggle. Unpublished collections are not accessible at `/collections` or `/collection/[slug]`.

---

### Admin Users (`/admin/users`)

**What the user sees on arrival.** A table of all users. Filter chips: All Roles, Supporter, Business Owner, Admin. Table columns: Display Name, Email, Role(s), Joined Date, Status (Active / Suspended), Actions (Change Role, Suspend/Unsuspend).

**Change role.** Opens a dialog: "[User Name]'s current role: [Role]. Change to:" — a role `<Select>` with available options. For Super Admin only, the Admin option is available. Confirm triggers a server action. A toast confirms the change.

**Suspend.** Opens a dialog: "Suspend [User Name]? They will not be able to sign in until reinstated." A "Confirm Suspension" red button. Suspension sets a `suspended_at` field on the user record; middleware checks this on every auth'd request.

---

## 7. Utility / Legal Screens

### Table

| Screen           | Route           | Layout              | Primary Action       | Secondary Actions        | Key Components                                                 | Data Required     | Auth | Phase | Notes                                                                 |
| ---------------- | --------------- | ------------------- | -------------------- | ------------------------ | -------------------------------------------------------------- | ----------------- | ---- | ----- | --------------------------------------------------------------------- |
| Privacy Policy   | `/privacy`      | Static              | —                    | Footer nav               | `StaticContentPage`                                            | Static legal text | No   | MVP   | Must be live before public launch; linked in footer and at sign-up    |
| Terms of Service | `/terms`        | Static              | —                    | Footer nav               | `StaticContentPage`                                            | Static legal text | No   | MVP   | Must be live before public launch                                     |
| 404 Not Found    | `not-found.tsx` | Constrained content | Search for something | Browse discover, go home | `NotFoundHeading`, `SearchBar`, `HomepageLink`, `DiscoverLink` | —                 | No   | MVP   | Friendly, branded; includes search bar so user can immediately search |
| Error            | `error.tsx`     | Constrained content | Try again            | Go to homepage           | `ErrorHeading`, `RetryButton`, `HomepageLink`                  | —                 | No   | MVP   | Generic error boundary for runtime failures in data-fetching routes   |

---

### 404 Not Found (`not-found.tsx`)

**What the user sees.** The standard navigation bar (full public nav, opaque). Content: the BLACQList mark or a small wordmark, a short and unbothered heading "That page doesn't exist." (not "404 Error" — plain language), a sub-line "It may have moved, or the link might be wrong." A full-width search bar with placeholder text: "Search for a business, category, or city..." and an Amber Gold submit button. Below the search bar, two text links: "Browse all businesses →" → `/discover` and "Go to homepage →" → `/`.

---

### Error (`error.tsx`)

**What the user sees.** Same nav. Heading: "Something went wrong." Short body: "We hit an error loading this page. Try refreshing, or return to the homepage." Two buttons: "Try again" (Amber Gold — calls `reset()` from the Next.js error boundary) and "Go to homepage" (ghost → `/`).

---

## 8. Screen Inventory Summary

| Screen Name             | Route                                  | Auth                    | Phase      | Layout Type         |
| ----------------------- | -------------------------------------- | ----------------------- | ---------- | ------------------- |
| Homepage                | `/`                                    | No                      | MVP        | Full-bleed hero     |
| Discover                | `/discover`                            | No                      | MVP        | Discovery grid      |
| Search Results          | `/search`                              | No                      | MVP        | Discovery grid      |
| City Landing            | `/city/[city-slug]`                    | No                      | MVP        | Full-bleed hero     |
| City + Category         | `/city/[city-slug]/[category-slug]`    | No                      | MVP        | Discovery grid      |
| Collections Index       | `/collections`                         | No                      | MVP        | Constrained content |
| Collection Page         | `/collection/[slug]`                   | No                      | MVP        | Constrained content |
| Business BLACQList Page | `/[city-slug]/business/[listing-slug]` | No (save gated)         | MVP        | BLACQList Page      |
| For Business            | `/for-business`                        | No                      | MVP        | Full-bleed hero     |
| About                   | `/about`                               | No                      | MVP        | Constrained content |
| Sign In                 | `/sign-in`                             | No (redirect if authed) | MVP        | Auth centered       |
| Sign Up                 | `/sign-up`                             | No (redirect if authed) | MVP        | Auth centered       |
| Onboarding              | `/onboarding`                          | Yes                     | MVP        | Multi-step form     |
| Forgot Password         | `/forgot-password`                     | No                      | MVP        | Auth centered       |
| Reset Password          | `/reset-password`                      | No (token-gated)        | MVP        | Auth centered       |
| Verify Email            | `/verify-email`                        | No (token-gated)        | MVP        | Auth centered       |
| Saved Listings          | `/account/saved`                       | Yes                     | MVP        | Dashboard sidebar   |
| Receipt Upload Beta     | `/account/receipts`                    | Yes                     | MVP (Beta) | Dashboard sidebar   |
| Account Settings        | `/account/settings`                    | Yes                     | MVP        | Dashboard sidebar   |
| Claim Entry             | `/claim`                               | Yes                     | MVP        | Constrained content |
| Claim Form              | `/claim/[listing-id]`                  | Yes                     | MVP        | Constrained content |
| Add Business            | `/add-business`                        | Yes                     | MVP        | Multi-step form     |
| Dashboard Home          | `/dashboard`                           | Yes (Owner)             | MVP        | Dashboard sidebar   |
| Page Editor             | `/dashboard/page`                      | Yes (Owner)             | MVP        | Dashboard sidebar   |
| Services Manager        | `/dashboard/services`                  | Yes (Owner)             | MVP        | Dashboard sidebar   |
| Admin Overview          | `/admin`                               | Yes (Admin)             | MVP        | Admin panel         |
| Admin Listings          | `/admin/listings`                      | Yes (Admin)             | MVP        | Admin panel         |
| Admin Listing Detail    | `/admin/listings/[id]`                 | Yes (Admin)             | MVP        | Admin panel         |
| Admin Claims Queue      | `/admin/claims`                        | Yes (Admin)             | MVP        | Admin panel         |
| Admin Claim Review      | `/admin/claims/[id]`                   | Yes (Admin)             | MVP        | Admin panel         |
| Admin Receipts Queue    | `/admin/receipts`                      | Yes (Admin)             | MVP (Beta) | Admin panel         |
| Admin Collections       | `/admin/collections`                   | Yes (Admin)             | MVP        | Admin panel         |
| Admin Collection Edit   | `/admin/collections/[id]`              | Yes (Admin)             | MVP        | Admin panel         |
| Admin Users             | `/admin/users`                         | Yes (Admin)             | MVP        | Admin panel         |
| Privacy Policy          | `/privacy`                             | No                      | MVP        | Static              |
| Terms of Service        | `/terms`                               | No                      | MVP        | Static              |
| 404 Not Found           | `not-found.tsx`                        | No                      | MVP        | Constrained content |
| Error                   | `error.tsx`                            | No                      | MVP        | Constrained content |
