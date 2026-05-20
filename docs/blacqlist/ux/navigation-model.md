# Navigation Model — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** UX + Product

This document defines every navigation system on The BLACQList platform — what it contains, when each version appears, how it adapts by user role, and where primary CTAs are placed. A designer or frontend engineer reading this document should be able to build every nav component without a verbal briefing.

---

## 1. Navigation Principles

**Discovery first, context aware.** The primary nav always surfaces the two paths that matter most to any visitor: discover something and, if they have a business, get found. All secondary nav recedes behind these.

**Amber Gold marks action.** Every primary call to action — sign up, claim a page, add a business — uses Amber Gold (`#E2A428`). No other element uses this color. If something is Amber Gold, it is a thing the user should do next.

**Role-aware rendering, not conditional hiding.** The nav does not show every element to every user with some items grayed out. It renders the correct nav for the correct role. An anonymous visitor sees a discovery nav. A business owner sees that nav plus their dashboard link. An admin sees a completely separate admin nav. Role-specific intent is designed before any conditional rendering is written.

**Thumb zone priority on mobile.** On a 375px screen, the primary action and the most important nav links belong in the bottom half where a right thumb can reach them. Top bars on mobile carry the logo and utility controls only — not the primary workflow.

**Minimal depth.** The BLACQList navigation is never more than two levels deep. There are no nested dropdown menus inside dropdown menus, no second-tier sidebar sections, no flyout panels with sub-flyouts. Depth adds cognitive load; the platform earns repeat use through simplicity.

**Persistent brand, not persistent ads.** The "Add Your Business" CTA in the nav exists because business owner acquisition is a permanent product priority — not because it is a campaign. It stays in the nav as long as the platform needs new pages. It is secondary to discovery links in ordering.

---

## 2. Public Nav — Desktop

The public nav serves anonymous visitors and any logged-in user who is browsing the discovery side of the platform (not their dashboard or admin panel).

### Layout

The nav bar is full-width, fixed to the top of the viewport (sticky), and uses the Deep Background color (`#19191E`) as its fill. On the homepage, the bar starts transparent over the hero image and transitions to solid `#19191E` on scroll (after approximately 80px). On all other pages, it is solid `#19191E` from load.

The bar has two zones: a left zone containing the logo and primary nav links, and a right zone containing utility actions.

```
[ Logo ]  Discover   Search   Cities   For Business         [ Search icon ]  [ Sign In ]  [ Sign Up → ]
```

The arrow on Sign Up indicates the Amber Gold button treatment.

### Left zone — logo

The BLACQList wordmark, left-aligned. Links to `/`. No tagline in the nav bar. Clear space maintained around the mark per brand guidelines.

### Left zone — primary nav links

These are text links in Cream (`#FCFAF4`) with no underline at rest. Hover state: Amber Gold color, no underline. Active/current page state: Amber Gold color with a 2px Amber Gold underline below the link text.

| Link label   | Route                                               | Notes                                                                              |
| ------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Discover     | `/discover`                                         | Browse by category or mood — curated entry points                                  |
| Search       | `/search`                                           | Goes directly to the search page with empty state                                  |
| Cities       | `/city/atlanta` (default, or dropdown to city list) | At MVP: links to Atlanta landing page. At V1: dropdown with the top active cities. |
| For Business | `/for-business`                                     | Marketing page for business owners. Always visible.                                |

"Cities" at MVP links directly to the Atlanta landing page (`/city/atlanta`). When the active city count grows in V1, it becomes a simple dropdown listing available city pages — no mega-menu, just a short list.

### Right zone — utility actions

| Element     | Treatment                               | Route / Behavior                                                                                                                                                                                                                              |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search icon | Icon button, Cream color                | On click: expands an inline full-width search input within the nav bar, keyboard-focused, with a clear (×) button. Does not navigate away. Pressing Enter or clicking the search icon in the expanded state navigates to `/search?q=[query]`. |
| Sign In     | Text link, Cream                        | `/sign-in`                                                                                                                                                                                                                                    |
| Sign Up     | Amber Gold button, rounded, `px-5 py-2` | `/sign-up`                                                                                                                                                                                                                                    |

The search expansion keeps the user on their current page until they submit. This is preferable to navigating to `/search` on icon click because it avoids unnecessary page transitions for users who may close the search without querying.

### Scroll behavior

- Homepage: nav starts with `background: transparent`, transitions to `background: #19191E` after 80px scroll. Logo switches from white wordmark to standard wordmark (both approved in the brand kit).
- All other pages: nav is solid `#19191E` from load. No transition.
- The nav bar is always sticky (does not scroll away). Height: 64px on desktop.

---

## 3. Public Nav — Mobile

On mobile (viewport width below 768px), the nav bar collapses to a compact top bar. There is no bottom navigation bar for anonymous visitors — bottom nav is a signed-in supporter feature (see Section 4).

### Top bar

The mobile top bar is 56px tall, full-width, with Deep Background fill (`#19191E`). It contains three elements:

```
[ Logo ]                          [ Search icon ]  [ Menu ≡ ]
```

- Logo: centered or left-aligned (left-aligned preferred — consistent with desktop).
- Search icon: right of center. On tap: navigates directly to `/search` (does not expand inline on mobile — full-page search is a better mobile experience than an inline input in a 56px bar).
- Hamburger (≡): rightmost. Opens a full-screen drawer from the right edge.

### Drawer

The drawer slides in from the right. It is full-height, full-width on screens below 480px, or 320px wide on screens 480px and above. Background: Deep Background (`#19191E`). A close (×) button appears in the top-right corner of the drawer.

Drawer content, top to bottom:

1. **Logo** — repeated in drawer header for orientation
2. **Primary nav links** — same as desktop, stacked vertically, 48px tap targets each
   - Discover → `/discover`
   - Search → `/search`
   - Cities → `/city/atlanta` (MVP) or a nested list of cities (V1)
   - For Business → `/for-business`
3. **Divider**
4. **Sign In** — full-width ghost button (outline, Cream border and text)
5. **Sign Up** — full-width Amber Gold button

Sign In and Sign Up are placed at the bottom of the nav links section because a visitor arriving at the drawer almost certainly arrived via a discovery intent, not an auth intent. They should see where they can go before being asked to create an account.

The drawer closes on: close button tap, tap outside the drawer, or navigation to a new route.

---

## 4. Signed-In Supporter Nav

When a user is authenticated as a Supporter (the default logged-in role), the nav updates in two places: the right utility zone on desktop, and the bottom navigation bar on mobile.

### Desktop — right zone changes

The Sign In link and Sign Up button are replaced by:

| Element                 | Treatment                                                                       | Behavior                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Notifications icon (V1) | Bell icon, Cream. Badge with count when unread notifications exist.             | At MVP: not present. At V1: opens a dropdown panel of recent activity (new review posted on a saved listing, etc.). |
| Avatar / account button | User's initials or profile photo in a circular 36px button. Cream ring outline. | Opens an account dropdown (see below).                                                                              |

The primary discovery nav links (Discover, Search, Cities, For Business) remain unchanged. Supporters still browse. The only change is the right zone.

### Account dropdown (desktop)

The dropdown opens below the avatar button, right-aligned to the button edge. Background: `#19191E` with a 1px Charcoal border. Minimum width: 200px.

| Item                 | Route               | Notes                                     |
| -------------------- | ------------------- | ----------------------------------------- |
| Saved                | `/account/saved`    | Their personal saved listings list        |
| Reviews (V1)         | `/account/reviews`  | Reviews they have written                 |
| Community Spend (V2) | `/account/spend`    | Personal spend dashboard                  |
| Receipts (V2)        | `/account/receipts` | Uploaded receipts                         |
| Settings             | `/account/settings` | Email, password, notification preferences |
| Divider              | —                   | —                                         |
| Sign Out             | —                   | Calls sign-out, redirects to `/`          |

Items marked V1 and V2 are not present at MVP. The dropdown at MVP contains: Saved, Settings, Sign Out.

### Mobile — bottom navigation bar

Signed-in Supporters on mobile receive a persistent bottom navigation bar. This replaces the need for a hamburger drawer for primary navigation. The bar is 56px tall, full-width, fixed to the bottom of the viewport, with Deep Background fill.

```
[ Home ]   [ Search ]   [ Saved ]   [ Account ]
```

| Tab     | Icon             | Route            | Badge                                                 |
| ------- | ---------------- | ---------------- | ----------------------------------------------------- |
| Home    | House icon       | `/`              | —                                                     |
| Search  | Magnifying glass | `/search`        | —                                                     |
| Saved   | Bookmark icon    | `/account/saved` | Save count badge at MVP (V1: dynamic count from list) |
| Account | Person icon      | `/account`       | Notification badge (V1)                               |

The active tab is indicated by an Amber Gold fill on the icon and Amber Gold label text. Inactive tabs use Charcoal (`#595758`) icons and labels.

The hamburger drawer remains available on mobile for Supporters via the top bar — the bottom nav covers primary workflows, but the drawer provides access to secondary links (For Business, Cities, etc.) that don't have bottom bar tabs.

---

## 5. Business Owner Nav

A Business Owner has everything a Supporter sees, plus access to their owner dashboard. The navigation reflects both contexts.

### Desktop — right zone changes

The right zone for a Business Owner is identical to the Supporter right zone (avatar + dropdown), but the dropdown includes an additional section at the top:

| Item             | Route               | Notes                                                                                                     |
| ---------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| **My Dashboard** | `/dashboard`        | Bold label, visually distinct from the supporter items below it. This is the owner's primary destination. |
| My Page          | `/dashboard/page`   | Direct link to their listing page editor                                                                  |
| Divider          | —                   | —                                                                                                         |
| Saved            | `/account/saved`    | Same as Supporter dropdown                                                                                |
| Reviews (V1)     | `/account/reviews`  | —                                                                                                         |
| Settings         | `/account/settings` | —                                                                                                         |
| Divider          | —                   | —                                                                                                         |
| Sign Out         | —                   | —                                                                                                         |

The separation between owner items (above the first divider) and supporter items (below) makes the dual-role context visible in the UI. The owner's primary action, My Dashboard, is always first.

### Context switching

The BLACQList does not use an explicit role switcher. Instead, the nav context is determined by which section of the platform the user is in:

- When a Business Owner is browsing the public side of the platform (`/`, `/search`, `/discover`, `/city/*`, `/[slug]/*`), they see the standard discovery nav with the owner dropdown additions.
- When a Business Owner navigates to `/dashboard/*`, the nav transitions to the owner dashboard nav (sidebar layout — see below).
- There is no toggle required. The URL determines the context.

### Owner dashboard nav (sidebar)

When a Business Owner is in the `/dashboard/*` section, the top nav is replaced by a two-part layout:

- A slim top bar with the BLACQList logo (links to `/` to return to the public site) and the account dropdown.
- A left sidebar containing the dashboard navigation.

Dashboard sidebar items:

| Item              | Route                     | Notes                                   |
| ----------------- | ------------------------- | --------------------------------------- |
| Overview          | `/dashboard`              | Default landing — stats and page health |
| My Page           | `/dashboard/page`         | Page editor                             |
| Images            | `/dashboard/images`       | Logo, cover, gallery management         |
| Analytics (V1)    | `/dashboard/analytics`    | Views, saves, CTA clicks                |
| Reviews (V1)      | `/dashboard/reviews`      | View and respond to reviews             |
| Verification (V1) | `/dashboard/verification` | Upload documents for Verified badge     |
| Upgrade (V1)      | `/dashboard/upgrade`      | Listing tier management                 |
| Settings          | `/dashboard/settings`     | Business profile settings               |

At MVP, the sidebar contains: Overview, My Page, Images, Settings.

### Mobile — bottom nav for Business Owners

On mobile, the Business Owner bottom nav adds a Dashboard tab:

```
[ Home ]   [ Search ]   [ Dashboard ]   [ Saved ]   [ Account ]
```

If four tabs feel crowded, Saved moves to the Account tab (accessible from the Account page) and Dashboard takes the third position. The decision should be made during visual design with real content — document the intent here as Dashboard taking priority over Saved in the bottom bar for owners.

---

## 6. Vendor Nav — V2

Not available until V2. This section documents the intended state for planning purposes.

### Additions to Business Owner Nav at V2

When a Business Owner activates a vendor storefront, their dashboard sidebar gains:

| Item             | Route                         | Notes                                           |
| ---------------- | ----------------------------- | ----------------------------------------------- |
| Products         | `/dashboard/products`         | Product listing management (add, edit, archive) |
| Orders           | `/dashboard/orders`           | Incoming orders, fulfillment status             |
| Payouts          | `/dashboard/payouts`          | Stripe Connect payout history and settings      |
| Vendor Analytics | `/dashboard/vendor-analytics` | Sales, revenue, top products                    |

These appear as a separate "Storefront" section in the sidebar below the standard "Page" section, with a section header label.

The top nav and public discovery nav are unchanged for vendors. They browse the same public site as other owners and supporters.

**Phase note:** The Vendor dashboard section, all `/dashboard/products`, `/dashboard/orders`, `/dashboard/payouts`, and `/dashboard/vendor-analytics` routes are blocked behind a V2 feature flag. Before V2, visiting these routes redirects to `/dashboard` with an informational message: "Your vendor storefront is coming soon."

---

## 7. Admin Nav

The Admin nav is completely separate from the public discovery nav. When an Admin or Super Admin user navigates to `/admin/*`, the entire layout changes. There is no discovery nav, no search bar, no public footer. The admin environment is its own product skin.

### Layout

The admin layout uses a fixed left sidebar (240px wide) and a content area that fills the remaining width. The sidebar background is Brand Black (`#000000`). The top of the sidebar contains the BLACQList wordmark and an "Admin" badge in Amber Gold.

### Primary nav items (sidebar)

These are available at MVP unless noted otherwise.

| Item         | Route                 | Phase |
| ------------ | --------------------- | ----- |
| Overview     | `/admin`              | MVP   |
| Listings     | `/admin/listings`     | MVP   |
| Claims       | `/admin/claims`       | MVP   |
| Collections  | `/admin/collections`  | MVP   |
| Users        | `/admin/users`        | MVP   |
| Verification | `/admin/verification` | V1    |
| Reviews      | `/admin/reviews`      | V1    |
| Corrections  | `/admin/corrections`  | V1    |
| Guides       | `/admin/guides`       | V2    |
| Analytics    | `/admin/analytics`    | V1    |
| Sponsored    | `/admin/sponsored`    | V1    |

### Secondary items (sidebar, below a divider)

| Item        | Route                | Phase                  | Notes                                    |
| ----------- | -------------------- | ---------------------- | ---------------------------------------- |
| Marketplace | `/admin/marketplace` | V2                     | Vendor approvals, order disputes         |
| Receipts    | `/admin/receipts`    | V2                     | Spot-check incoming receipt data         |
| Flow Map    | `/admin/flow-map`    | V3                     | Manage city and category node visibility |
| System      | `/admin/system`      | MVP — Super Admin only | Environment config, audit logs           |

### Phase notes

V1 items (Verification, Reviews, Corrections, Analytics, Sponsored) appear in the sidebar at their phase but are inactive before then — they show a "Coming in V1" label when clicked rather than a 404 or a blank page. This prevents confusion during the period when the admin is aware these features are planned but not yet live.

V2 and V3 items are hidden entirely from the sidebar until their phase begins.

### Returning to the public site

The admin sidebar footer contains a "View public site →" link that opens the public homepage in a new tab. Admins do not navigate between admin and public contexts within the same tab — the admin panel is a separate environment.

### Super Admin distinction

Super Admins see everything an Admin sees, plus the System item in the secondary section. There is no separate nav for Super Admin — the additional access is surfaced through the System route and elevated permissions on existing admin views (e.g., ability to view financial reports on the Analytics page).

---

## 8. Footer Nav

The footer appears on all public-facing pages. It does not appear within the admin panel or the owner dashboard sidebar layout (though a slim footer with legal links may appear at the bottom of the dashboard content area).

### Layout

The footer uses Deep Background (`#19191E`) as its fill. The main footer content is a four-column grid (collapses to two columns on tablet, one column on mobile). Below the column grid is a legal row.

The BLACQList tagline "Find & Be Found." appears above the column grid, set in the brand headline font (Glacial Indifference), at a large size, in Cream (`#FCFAF4`).

Social icons (Instagram, TikTok, Twitter/X, LinkedIn) appear to the right of or below the tagline, before the column grid. All link to `@theblacqlist` on their respective platforms.

### Column 1 — Platform

| Link        | Route                   | Phase                      |
| ----------- | ----------------------- | -------------------------- |
| Discover    | `/discover`             | MVP                        |
| Search      | `/search`               | MVP                        |
| Events      | `/discover?type=event`  | V1                         |
| Jobs        | `/discover?type=job`    | V1                         |
| Marketplace | `/marketplace`          | V2                         |
| Collections | `/discover/collections` | MVP (admin creates at MVP) |
| BLACQLight  | `/blacqlight`           | V1                         |

### Column 2 — For Businesses

| Link              | Route                   | Phase                         |
| ----------------- | ----------------------- | ----------------------------- |
| For Business      | `/for-business`         | MVP                           |
| Claim Your Page   | `/claim`                | MVP                           |
| Add Your Business | `/add-business`         | MVP                           |
| Pricing           | `/for-business#pricing` | V1                            |
| For Vendors       | `/for-vendors`          | V2                            |
| For Sponsors      | `/for-sponsors`         | V1 (manual sales entry point) |

### Column 3 — Company

| Link    | Route      | Phase                             |
| ------- | ---------- | --------------------------------- |
| About   | `/about`   | MVP                               |
| Careers | `/careers` | MVP (can be a simple page at MVP) |
| Press   | `/press`   | MVP                               |
| Contact | `/contact` | MVP                               |

### Column 4 — Community

| Link             | Route         | Phase |
| ---------------- | ------------- | ----- |
| The BLACQLight   | `/blacqlight` | V1    |
| City Guides      | `/guides`     | V2    |
| Community Impact | `/impact`     | V2    |

### Legal row (bottom)

The legal row sits below a thin Charcoal divider. It is a single horizontal row on desktop, stacked on mobile.

| Element              | Notes                       |
| -------------------- | --------------------------- |
| © 2026 The BLACQList | Updated year at deploy time |
| Privacy Policy       | `/privacy`                  |
| Terms of Service     | `/terms`                    |
| Cookie Policy        | `/cookies`                  |
| DMCA                 | `/dmca`                     |

### Phase handling in the footer

V1+ and V2+ items in the footer columns are present in the HTML from MVP but rendered in Charcoal (`#595758`) with no hover treatment, and link to a holding page at their route that says "Coming soon." This approach keeps the footer informative (users can see what the platform is becoming) without requiring dead links or JavaScript to hide items by phase flag.

Items not yet available do not carry an Amber Gold style — only active, navigable links receive Amber Gold hover treatment.

---

## 9. Role Switching Behavior

The BLACQList does not implement an explicit role switcher UI. Role context is inferred from URL prefix. This is the intended behavior:

### URL-driven context

| URL prefix                                          | Nav context shown                                       | Logic                                                     |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------- |
| `/`, `/search`, `/discover`, `/city/*`, `/[slug]/*` | Public discovery nav (with role-appropriate right zone) | Public browsing — all roles see the discovery nav         |
| `/dashboard/*`                                      | Owner dashboard sidebar layout                          | Requires Business Owner role; redirects non-owners to `/` |
| `/account/*`                                        | Standard discovery nav, account sub-nav on page         | Supporter-level access; also accessible to owners         |
| `/admin/*`                                          | Admin panel layout                                      | Requires Admin or Super Admin role; 403 for others        |

### Dual-role scenario: Business Owner acting as a Supporter

A Business Owner browsing the public site (saving another business's page, reading a BLACQList Page) is acting in their Supporter capacity. The nav shows the discovery nav with the owner dropdown. Saving a page, writing a review, or sharing a link — all Supporter actions — work without any role switch required. The system handles this because saves, reviews, and shares operate on `user_id`, which has no role restriction beyond being authenticated.

The Business Owner does not need to "switch to Supporter mode" to perform Supporter actions on the public site.

### Dual-role scenario: Business Owner navigating to dashboard mid-browse

When a Business Owner clicks "My Dashboard" from the account dropdown while browsing a listing, the page navigates to `/dashboard`. The layout transitions to the dashboard sidebar layout. The discovery nav disappears. A "← View public site" link in the sidebar header or a logo click returns them to the public site.

There is no fade, modal, or confirmation on context switch. It is a normal page navigation.

### Edge case: Admin who is also a Business Owner

Admin users should not manage listings through the public owner flow. An Admin with a business that needs to be listed should use the admin panel to create and manage it directly, or have a separate non-admin account for owner workflows. This keeps admin and owner audit trails clean. Document this in the Admin onboarding guide — it does not require a UI solution.

---

## 10. Empty-State Navigation

When a user lands on a page with no content to show, the nav remains in its standard state (never hidden), but the page content area provides directional prompts to keep the user moving.

### Empty saved list — `/account/saved`

The page shows the full account layout with the standard discovery nav and account sub-nav intact. In the content area:

- Heading: "Nothing saved yet."
- Body: "When you find a business worth coming back to, save it here. It takes one tap."
- Primary action: Amber Gold button — "Browse Businesses" → `/discover`
- Secondary link: "Search for something specific" → `/search`

### Empty owner dashboard — new owner who has not completed their Page

The dashboard sidebar is visible with all available nav items. The content area of the Overview page shows an onboarding checklist instead of stats:

- Heading: "Your page is almost ready."
- Checklist steps (each item links to the relevant dashboard section):
  1. Add your business info → `/dashboard/page#basic-info`
  2. Upload your logo and cover image → `/dashboard/images`
  3. Set your primary CTA → `/dashboard/page#cta`
  4. Preview and publish → `/dashboard/page#publish`
- Progress indicator: "2 of 4 steps complete" — shown as a progress bar below the heading.
- The standard stats cards (views, saves, clicks) are present but show "—" until the page is published.

### Empty search results

Search results page retains the full nav. The content area shows:

- Heading: "No results for '[query]'."
- Body: "Try different words, or browse a category."
- Three suggestion links:
  - "Browse all in Atlanta" → `/city/atlanta`
  - "Browse [matched category if any] near you" → `/discover?category=[slug]`
  - "Search all businesses" → `/search` (clears filters)

### Empty admin claim queue — `/admin/claims`

The admin panel sidebar remains. The claims content area shows:

- Heading: "No pending claims."
- Body: "All claims have been reviewed." (no action prompt — this is a done state, not a stuck state)
- No CTA. No "get started" prompt. Admins are not users to be onboarded.

### New Supporter — just signed up, no saves, no activity

On the account overview page (or the first meaningful page a new Supporter lands on after completing sign-up), a welcome prompt appears in the main content area:

- Heading: "Welcome to The BLACQList."
- Body: "Start by finding a Black-owned business near you."
- Suggested category links: Food & Dining, Beauty & Wellness, Health & Fitness, Fashion, Professional Services (the five most browsable categories)
- These are rendered as Amber Gold-outlined tag-style buttons, not full CTAs, to feel exploratory rather than directive.

After a Supporter has performed any action (one save, one search, one page view), this welcome prompt does not appear again.

---

## 11. CTA Placement Rules

Primary CTAs use Amber Gold (`#E2A428`) fill with Brand Black (`#000000`) text. Secondary CTAs use a Charcoal outline with Cream text. Destructive or exit CTAs use no Amber Gold.

### Homepage

| CTA                         | Treatment                                                                                                                   | Placement                                                                                                     | Route                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Hero search bar             | Full-width input with Amber Gold submit button. Placeholder: "Find a Black-owned restaurant, salon, or service in Atlanta…" | Center of hero section, above the fold                                                                        | Submits to `/search?q=[query]&city=[city]` |
| "Claim Your Page"           | Amber Gold button                                                                                                           | Below hero, in the "For Business Owners" band — above the fold on desktop, visible after one scroll on mobile | `/claim`                                   |
| "Add Your Business"         | Ghost button (Cream outline)                                                                                                | Adjacent to "Claim Your Page" in the same band                                                                | `/add-business`                            |
| "Explore [Collection Name]" | Amber Gold text link with arrow (→)                                                                                         | On each editorial collection card                                                                             | `/collection/[slug]`                       |
| "Browse Atlanta"            | Secondary text link                                                                                                         | City spotlight section                                                                                        | `/city/atlanta`                            |

The hero search bar is not a button — it is the primary action input. There is no "Search" button separate from the search bar; the Amber Gold submit appears inside or immediately adjacent to the input, as a unified component.

### BLACQList Page

| CTA                                                    | Treatment                                                                 | Placement                                                                                                                                                  | Behavior                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Primary CTA (Book/Order/Call/Visit — owner configured) | Amber Gold button, full-width on mobile, 160px min-width on desktop       | Hero section, visible above the fold. On mobile: also pinned as a sticky bottom bar (full-width, Amber Gold, 56px height) while the user scrolls the page. | External link (owner-configured URL or tel: link)                              |
| Save                                                   | Icon button (bookmark outline → filled on save), Cream on dark background | Hero section, secondary position — to the right of the primary CTA on desktop, in the hero on mobile                                                       | Toggle save state for authenticated users. Unauthenticated: prompt to sign in. |
| Share                                                  | Icon button (share/arrow icon), Cream                                     | Hero section, tertiary — adjacent to Save                                                                                                                  | Opens native share sheet on mobile; copy-link modal on desktop                 |

The mobile sticky CTA on BLACQList Pages is a product decision, not a design detail. It remains visible while the user scrolls through the About section, gallery, and services list. It disappears if the user reaches the contact section at the bottom (where the contact info provides direct alternatives). This behavior preserves the CTA without obscuring content.

### Search results

Listing cards are the CTA. The card itself is tappable/clickable and navigates to the BLACQList Page. There are no individual "View Page" buttons inside each card — the card is the button. The only in-card interactive element beyond the card click is the Save icon (bookmark) in the top-right corner of the card.

Keeping cards clean with no secondary CTAs is an intentional choice. Adding "View Page," "Contact," and "Save" buttons to every card creates visual noise and slows scanning.

### For Business / marketing pages

| CTA                               | Treatment                              | Placement                                                                                  |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| "Claim Your Page"                 | Amber Gold button, large (`py-4 px-8`) | Hero section, above the fold                                                               |
| "Add Your Business"               | Ghost button, Cream outline            | Hero section, secondary to Claim                                                           |
| "Claim Your Page" (repeated)      | Amber Gold button                      | At the end of each feature section on the page — a CTA closes each value proposition block |
| "Start for free" or "Get started" | Amber Gold button                      | Above the pricing section (V1)                                                             |

### Footer — persistent CTA

The For Businesses footer column acts as a permanent low-friction CTA surface. "Claim Your Page" and "Add Your Business" are always present and always functional. They do not use Amber Gold button treatment in the footer (that would compete with everything else) — they are standard footer links, but they are positioned first in that column for visibility.

### Empty states

Empty state primary actions use Amber Gold button treatment. They are the only action on the empty state page and should feel inviting, not urgent. The button is mid-size (`py-2 px-6`), centered, with the standard Amber Gold fill.

### Mobile sticky CTA — BLACQList Page (detail)

Layout type: full-width sticky bottom bar  
Position: fixed, bottom: 0, full viewport width  
Height: 56px  
Background: Amber Gold (`#E2A428`)  
Text: Brand Black (`#000000`), Quicksand Bold Italic, 16px  
Visibility: shown after the user has scrolled past the hero CTA (approximately 300px from page top). Hidden while the hero CTA is in the viewport (no duplication). Hidden again when the user reaches the contact section at page bottom.  
z-index: above content, below nav bar

---

## 12. Search Bar Behavior

Search is the highest-frequency interaction on the platform. Every decision about search bar behavior is a conversion decision.

### Locations

The search bar appears in two locations:

1. **Homepage hero** — large, centered, full-width on mobile, 680px max-width on desktop. This is the primary first-touch search surface.
2. **Global nav — desktop** — the search icon in the right utility zone. On click, expands an inline input within the nav bar. Submit navigates to `/search`.

There is no search bar in the mobile top bar (the search icon navigates directly to `/search`). There is no persistent search bar on non-homepage pages — users search from the nav icon or from the `/search` page.

### Placeholder text

The placeholder text should reflect real searches that work, in real language:

- "Find a Black-owned restaurant in Atlanta"
- "Search by name, category, or city"
- "Barbers, salons, tutors, attorneys…"

Rotate or A/B test placeholder variants. Never use "Search…" alone — it says nothing about what the platform knows.

### Autosuggest

| Phase | Behavior                                                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP   | No autosuggest. Plain text input → submit → results page.                                                                                                  |
| V1    | Category and city suggestions appear as the user types (e.g., "rest" suggests "Restaurants" category and "Atlanta" city). Static suggestion lists, not ML. |
| V2    | AI-powered suggestions: business names, category matches, recent popular searches. Clearly labeled "Suggested."                                            |

At MVP, the absence of autosuggest is acceptable because the query → results round trip is fast (sub-1.5 seconds target per the dev ticket spec). Autosuggest adds complexity that is not required to prove the product works.

### Submit behavior

- Enter key or tap on the Amber Gold search button submits the query.
- Submitting navigates to `/search?q=[query]` (or `/search?q=[query]&city=[city]&category=[category]` if pre-populated from a city or category landing page).
- Empty query submission is allowed — it navigates to `/search` with no filters, showing all listings. This is preferable to blocking empty submission (some users browse without a specific query).

### Navigation search expansion (desktop)

When the search icon is clicked in the desktop nav:

1. The nav right zone animates: Sign In and Sign Up fade out, a full-width input with Amber Gold submit button fades in.
2. Input is focused automatically.
3. User types and presses Enter or clicks submit → navigates to `/search?q=[query]`.
4. User presses Escape or clicks (×) → input closes, Sign In and Sign Up return.

This expansion does not affect the logo or primary nav links. The nav bar maintains its height (64px).

---

## 13. Routes Not Available at MVP

The following nav items, routes, and features are referenced in this document but are not available at MVP. This table is the single source of truth for what a frontend engineer should defer or stub.

| Route / Nav Item                                             | Phase       | Why Not in MVP                                                                                                                  |
| ------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/discover?type=event` — Events in nav/footer                | V1          | Event Page template is V1                                                                                                       |
| `/discover?type=job` — Jobs in nav/footer                    | V1          | Job listing template is V1                                                                                                      |
| `/marketplace` — Marketplace in nav/footer                   | V2          | Commerce layer is V2                                                                                                            |
| `/blacqlight` — BLACQLight in nav/footer                     | V1          | Editorial CMS is V1                                                                                                             |
| `/guides` — City Guides in footer                            | V2          | City guide CMS is V2                                                                                                            |
| `/impact` — Community Impact in footer                       | V2          | Requires V2 spend data to be meaningful                                                                                         |
| `/for-vendors` — For Vendors in footer                       | V2          | Vendor onboarding is V2                                                                                                         |
| `/for-sponsors` — For Sponsors in footer                     | V1 (manual) | Sponsors are manual sales at MVP; landing page can exist as info-only                                                           |
| `Cities` dropdown in nav                                     | V1          | At MVP, "Cities" links to Atlanta only. Dropdown with multiple cities is V1 when 3+ city pages have meaningful listing density. |
| Account dropdown: Reviews                                    | V1          | Reviews display is V1                                                                                                           |
| Account dropdown: Community Spend                            | V2          | Personal spend dashboard is V2                                                                                                  |
| Account dropdown: Receipts                                   | V2          | Receipt upload (full) is V2; beta intake is MVP but no account dashboard view                                                   |
| Admin sidebar: Verification                                  | V1          | Verification queue is V1                                                                                                        |
| Admin sidebar: Reviews                                       | V1          | Review moderation queue is V1                                                                                                   |
| Admin sidebar: Corrections                                   | V1          | Community corrections are V1                                                                                                    |
| Admin sidebar: Analytics                                     | V1          | Full admin analytics dashboard is V1 (basic stats are MVP)                                                                      |
| Admin sidebar: Sponsored                                     | V1          | Sponsored placements are V1                                                                                                     |
| Admin sidebar: Guides                                        | V2          | City guides are V2                                                                                                              |
| Admin sidebar: Marketplace                                   | V2          | Marketplace admin is V2                                                                                                         |
| Admin sidebar: Receipts (admin)                              | V2          | Receipt spot-check is V2                                                                                                        |
| Admin sidebar: Flow Map                                      | V3          | Dollar-flow map is V3                                                                                                           |
| Notifications icon in supporter nav                          | V1          | Notification system is V1                                                                                                       |
| Business Owner bottom nav: Dashboard tab                     | MVP         | Present at MVP — listed here to confirm it IS in scope                                                                          |
| Vendor dashboard sidebar section (Products, Orders, Payouts) | V2          | Vendor storefront is V2                                                                                                         |
| `/account/spend`                                             | V2          | Spend dashboard is V2                                                                                                           |
| `/account/receipts` (full view)                              | V2          | Full receipt management is V2                                                                                                   |
| AI-powered autosuggest in search                             | V2          | AI layer is V2                                                                                                                  |
| Near Me search / geo filter                                  | V2          | Geo search requires maps API integration deferred to V2                                                                         |
| Named save lists                                             | Beta        | Single saved list is MVP; named/organized lists are Beta                                                                        |
| Follow a business                                            | V1          | Notification infrastructure prerequisite is V1                                                                                  |
| City guide nav item in public nav                            | V2          | City guides are V2                                                                                                              |
| Neighborhood pages                                           | V2+         | Not in current phase plan                                                                                                       |
| Dollar-flow map visualization                                | V3          | Requires 6+ months of spend data                                                                                                |
| AI concierge / conversational discovery                      | V2 (beta)   | Requires listing data quality at scale                                                                                          |
| Sponsor campaign dashboard                                   | V3          | Sponsor self-serve is V3                                                                                                        |
| Contributor system (BLACQLight)                              | V2          | Trusted writer submissions are V2                                                                                               |

---

**Recommended next artifact:** `docs/blacqlist/ux/user-flow-discovery.md` — the step-by-step flow for an anonymous visitor discovering and acting on a BLACQList Page, including the conversion moment to account creation.
