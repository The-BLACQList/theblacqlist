# Pre-Launch User Perspective Tests — The BLACQList

**Created:** 2026-05-11
**Environment:** Staging (run against production only after all tests pass on staging)
**Status:** Not yet run
**Estimated time:** ~3–4 hours to complete all perspectives end to end

---

## How to Use This Document

This is a human-run walkthrough test — not a smoke test (that's `prelaunch-smoke-test.md`) and not the functional test plan (that's `mvp-test-plan.md`). This document tests the **lived experience** from each user's perspective from the moment they land on the site through their core journey.

Each perspective section can be assigned to a different tester. Run all perspectives before approving soft launch. Mark each test row as PASS, FAIL, or SKIP with notes.

**Tester setup:**

| Role                      | Account type                                  | Instructions                             |
| ------------------------- | --------------------------------------------- | ---------------------------------------- |
| Tester A — Anonymous      | No account, incognito window                  | New incognito window for each session    |
| Tester B — New Supporter  | New email address, no existing account        | Use a real email address you can check   |
| Tester C — Business Owner | Account with a claimed, published listing     | Use the staging test owner account       |
| Tester D — Admin          | Account with `role = 'admin'` in `user_roles` | Use the staging admin account            |
| Tester E — Mobile         | Mobile device or Chrome DevTools at 375px     | Use a real device if possible            |
| Tester F — Security       | Technical tester, any account                 | Tests auth boundaries and data isolation |

---

## Perspective 1 — Anonymous Visitor

> A person who finds The BLACQList for the first time. No account. May be searching for a specific business, may be browsing. Tests the full discovery and trust-building journey.

### 1-A: Homepage First Impression

| #   | What to do                                         | Expected                                                                                 | Pass/Fail | Notes |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- | ----- |
| 1   | Open the homepage in a new incognito browser tab   | Page loads within 3 seconds                                                              |           |       |
| 2   | Read the hero section headline and subhead         | Clear value proposition about Black-owned businesses; no placeholder text                |           |       |
| 3   | Look for a search bar or discovery CTA             | Visible in the hero; works on click/tap                                                  |           |       |
| 4   | Scroll the full homepage without clicking anything | No broken images (gray boxes), no "undefined", no `[object Object]`, no mock data labels |           |       |
| 5   | Check the header                                   | Sign In and Get Listed links visible; no dashboard or account links                      |           |       |
| 6   | Check the footer                                   | All four columns visible; legal links at bottom (Privacy, Terms, Cookies) present        |           |       |
| 7   | Click Privacy Policy in the footer                 | Loads `/privacy` with full content; no 404                                               |           |       |
| 8   | Click Terms of Service in the footer               | Loads `/terms` with full content; no 404                                                 |           |       |
| 9   | Click Cookie Policy in the footer                  | Loads `/cookies` with full content; no 404                                               |           |       |

---

### 1-B: Search and Discovery

| #   | What to do                                               | Expected                                                             | Pass/Fail | Notes |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------- | --------- | ----- |
| 10  | Search for "restaurant"                                  | Returns listings; each card has business name, city, category        |           |       |
| 11  | Search for "atlanta restaurant" or a city-specific query | Results filtered to Atlanta or nearby                                |           |       |
| 12  | Search for a nonsense term (e.g., "xyzqwertyzzz")        | Shows empty state with friendly message; not a blank page or error   |           |       |
| 13  | Navigate to `/discover`                                  | Listings grid renders with real data                                 |           |       |
| 14  | Click a listing card                                     | Opens the business page at `/[city-slug]/business/[listing-slug]`    |           |       |
| 15  | On a business page, view page source (`Cmd+U`)           | Business name is in `<title>` tag (server-rendered, not blank)       |           |       |
| 16  | Click the "Back" button                                  | Returns to the discovery page at the correct scroll position or page |           |       |
| 17  | Try to save a listing while not signed in                | Prompted to sign in; not silently ignored                            |           |       |

---

### 1-C: Business Discovery Page (Entity Page)

| #   | What to do                                                 | Expected                                                                        | Pass/Fail | Notes |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ----- |
| 18  | Navigate to a published business page                      | All sections render: hero, at-a-glance, story/about, offerings, hours           |           |       |
| 19  | Check the business name, category, and city                | Real data; no "Mock Business", "Test Listing", or placeholder text              |           |       |
| 20  | Check the CTA button (if configured)                       | Button is visible; clicking it performs the expected action (link, phone, etc.) |           |       |
| 21  | Inspect the hero image area                                | Image loads or graceful fallback shown; no broken image icons                   |           |       |
| 22  | Check the "Claim this page" prompt if listing is unclaimed | Link to `/claim` visible; navigates correctly                                   |           |       |
| 23  | Check the "Share" button                                   | Opens share dialog or copies link; does not throw a JS error                    |           |       |
| 24  | Use the browser back button from the entity page           | Returns to previous page correctly                                              |           |       |

---

### 1-C: Collections and Editorial

| #   | What to do                  | Expected                                                                      | Pass/Fail | Notes |
| --- | --------------------------- | ----------------------------------------------------------------------------- | --------- | ----- |
| 25  | Navigate to `/collections`  | Collections list renders; no "No collections found" if seed collections exist |           |       |
| 26  | Click a collection          | Opens `/collections/[slug]` with listings inside                              |           |       |
| 27  | Navigate to `/about`        | About page loads with real copy; no placeholder text or empty sections        |           |       |
| 28  | Navigate to `/contact`      | Four email channel cards visible; all `mailto:` links are correct             |           |       |
| 29  | Navigate to `/for-business` | Page loads; contains clear value proposition and CTA for business owners      |           |       |
| 30  | Navigate to `/pricing`      | Pricing page loads with all four tier cards and correct prices                |           |       |

---

### 1-D: Navigation and Orientation

| #   | What to do                                                          | Expected                                                           | Pass/Fail | Notes |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- | ----- |
| 31  | Navigate to a URL that doesn't exist (e.g., `/this-does-not-exist`) | Custom 404 page loads; includes navigation home                    |           |       |
| 32  | Navigate to `/admin` while not signed in                            | Redirected to `/sign-in?next=/admin`                               |           |       |
| 33  | Navigate to `/dashboard` while not signed in                        | Redirected to `/sign-in?next=/dashboard`                           |           |       |
| 34  | Navigate to `/account` while not signed in                          | Redirected to `/sign-in?next=/account`                             |           |       |
| 35  | Check all footer column links that are marked "coming soon"         | Render as non-interactive text (not broken links); no 404 on click |           |       |

---

## Perspective 2 — New Community Supporter

> A community member creating an account for the first time to track spending, save businesses, and engage with the platform. Tests the full sign-up and engagement journey.

### 2-A: Account Creation

| #   | What to do                                                    | Expected                                                                        | Pass/Fail | Notes |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ----- |
| 36  | Click Sign In from the header                                 | Navigates to `/sign-in`                                                         |           |       |
| 37  | Click "Create account" or equivalent link on sign-in page     | Navigates to `/sign-up`                                                         |           |       |
| 38  | Enter a valid email and password; submit                      | Redirected to verify-email page or onboarding; no error                         |           |       |
| 39  | Check the email inbox                                         | Verification email received from a `@theblacqlist.com` or Resend domain address |           |       |
| 40  | Click the email verification link                             | Account verified; redirected to onboarding or account page                      |           |       |
| 41  | Submit the sign-up form with a weak password (< 8 characters) | Inline validation error shown; form not submitted                               |           |       |
| 42  | Submit the sign-up form with an invalid email                 | Inline validation error shown                                                   |           |       |
| 43  | Try to sign up with an email that already has an account      | Appropriate error shown; form not submitted                                     |           |       |

---

### 2-B: Onboarding

| #   | What to do                                           | Expected                                                                              | Pass/Fail | Notes |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | --------- | ----- |
| 44  | Complete the onboarding flow after account creation  | Onboarding steps complete; lands on account or dashboard                              |           |       |
| 45  | Refresh the page mid-onboarding                      | Returns to onboarding; does not lose state entirely (ideally resumes at current step) |           |       |
| 46  | Complete onboarding with all optional fields skipped | Still reaches the end state; no validation blocking on optional fields                |           |       |

---

### 2-C: Saving Businesses

| #   | What to do                                         | Expected                                                                | Pass/Fail | Notes |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------- | --------- | ----- |
| 47  | Sign in and navigate to a business page            | Save button visible                                                     |           |       |
| 48  | Click the Save/heart button                        | Business saved; button state changes (filled/confirmed); no page reload |           |       |
| 49  | Navigate to `/account/saved`                       | Saved business appears in the list                                      |           |       |
| 50  | Un-save the business from the saved list           | Business removed from list; no error                                    |           |       |
| 51  | Un-save the business from the business page itself | Same result — removed, button state updates                             |           |       |
| 52  | Save 3 different businesses                        | All three appear in `/account/saved`                                    |           |       |

---

### 2-D: Receipt Submission

| #   | What to do                                                     | Expected                                                                     | Pass/Fail | Notes |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------- | ----- |
| 53  | Navigate to `/account/receipts/new`                            | Form renders; business search field and amount field visible                 |           |       |
| 54  | Search for a business in the form                              | Autocomplete or lookup works; returns matching listings                      |           |       |
| 55  | Enter a valid dollar amount and submit without a receipt image | Submit succeeds; redirected to receipts list or confirmation                 |           |       |
| 56  | Navigate to `/account/receipts`                                | Submitted receipt appears in the list with amount and date                   |           |       |
| 57  | Submit the form with a $0 amount                               | Validation error; form not submitted                                         |           |       |
| 58  | Submit the form with an empty amount field                     | Validation error; form not submitted                                         |           |       |
| 59  | Submit a receipt with a photo attached                         | Photo uploads; receipt saved with attachment                                 |           |       |
| 60  | Navigate to `/account/community-spend`                         | Page loads; no runtime error ("SUPABASE_SERVICE_ROLE_KEY" should not appear) |           |       |
| 61  | Check the community spend hero stat                            | Total spend reflects submitted receipts (may show $0 on fresh staging)       |           |       |

---

### 2-E: Account Settings

| #   | What to do                                        | Expected                                                                        | Pass/Fail | Notes |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ----- |
| 62  | Navigate to `/account/settings`                   | Settings page renders with name, email, and preference fields                   |           |       |
| 63  | Change display name and save                      | Change persists on page reload                                                  |           |       |
| 64  | Toggle the community spend opt-out (if available) | Toggle saves without error                                                      |           |       |
| 65  | Click sign out                                    | Session cleared; redirected to homepage or sign-in; account links hidden in nav |           |       |
| 66  | After sign-out, navigate to `/account`            | Redirected to `/sign-in`                                                        |           |       |

---

## Perspective 3 — Business Owner

> A business owner who has claimed their page and is managing their listing. Tests the full dashboard experience from login to published listing.

### 3-A: Sign-In and Dashboard Entry

| #   | What to do                          | Expected                                           | Pass/Fail | Notes |
| --- | ----------------------------------- | -------------------------------------------------- | --------- | ----- |
| 67  | Sign in with the test owner account | Redirected to `/account` or `/dashboard`; no error |           |       |
| 68  | Navigate to `/dashboard`            | Dashboard index loads; lists claimed pages         |           |       |
| 69  | Navigate to `/dashboard/pages`      | List of owned listings visible                     |           |       |
| 70  | Click a listing in the list         | Opens `/dashboard/pages/[entityId]` overview       |           |       |

---

### 3-B: Page Editor

| #   | What to do                                                        | Expected                                                                                 | Pass/Fail | Notes |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------- | ----- |
| 71  | Navigate to the Edit tab for an owned listing                     | `/dashboard/pages/[entityId]/edit` loads                                                 |           |       |
| 72  | Change the business tagline and save                              | Change persists; no error; listing tagline updated                                       |           |       |
| 73  | Change the business description and save                          | Change persists; description updated on public page                                      |           |       |
| 74  | Check the "View Live Page" link in the dashboard                  | Opens the public listing page in a new tab                                               |           |       |
| 75  | Try to save an empty required field (e.g., business name cleared) | Validation error shown; data not saved with empty required field                         |           |       |
| 76  | Save meta title and meta description (SEO fields)                 | Saved; reflected in page source `<title>` and `<meta name="description">` on the listing |           |       |

---

### 3-C: Media Upload

| #   | What to do                                          | Expected                                                            | Pass/Fail | Notes |
| --- | --------------------------------------------------- | ------------------------------------------------------------------- | --------- | ----- |
| 77  | Navigate to `/dashboard/pages/[entityId]/media`     | Media management page renders                                       |           |       |
| 78  | Upload a logo/profile image (JPEG or PNG under 5MB) | Upload completes; image appears in the media manager                |           |       |
| 79  | Upload a cover image                                | Upload completes; cover image previews in the manager               |           |       |
| 80  | Upload a gallery image                              | Appears in gallery section                                          |           |       |
| 81  | Attempt to upload a file over the size limit        | Error message shown; file not uploaded                              |           |       |
| 82  | Attempt to upload a non-image file (e.g., PDF)      | Error message shown; file not accepted                              |           |       |
| 83  | Navigate to the public listing page after uploads   | Logo, cover, and gallery images render correctly on the public page |           |       |

---

### 3-D: Services and Products

| #   | What to do                                              | Expected                                   | Pass/Fail | Notes |
| --- | ------------------------------------------------------- | ------------------------------------------ | --------- | ----- |
| 84  | Navigate to `/dashboard/pages/[entityId]/offerings`     | Services/offerings tab renders             |           |       |
| 85  | Add a new service with name, description, and price     | Service saved; appears in the list         |           |       |
| 86  | Navigate to `/dashboard/services`                       | Services list renders                      |           |       |
| 87  | Navigate to `/dashboard/services/new`                   | New service form renders                   |           |       |
| 88  | Navigate to `/dashboard/products`                       | Products list renders                      |           |       |
| 89  | Navigate to `/dashboard/products/new`                   | New product form renders                   |           |       |
| 90  | Create a new product and navigate to the public listing | Product appears in the marketplace section |           |       |

---

### 3-E: Analytics

| #   | What to do                                               | Expected                                                                | Pass/Fail | Notes |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------- | --------- | ----- |
| 91  | Navigate to `/dashboard/pages/[entityId]/analytics`      | Analytics page loads; no error                                          |           |       |
| 92  | Check the metric cards                                   | Page views, saves, and share counts visible (may be 0 on fresh staging) |           |       |
| 93  | Navigate to `/dashboard/pages/[entityId]/ai-suggestions` | AI Suggestions page loads; checklist visible; no AI provider error      |           |       |
| 94  | Check the page optimization checklist                    | Score renders; checklist items show passed/failed state                 |           |       |

---

### 3-F: Ownership Boundary

| #   | What to do                                                                                                             | Expected                                                         | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------- | ----- |
| 95  | Get the `entityId` of a listing owned by a different owner; visit `/dashboard/pages/[otherEntityId]` as the test owner | Receives a 404 or redirect; cannot see another owner's dashboard |           |       |
| 96  | Get the `entityId` of a listing owned by a different owner; visit `/dashboard/pages/[otherEntityId]/edit`              | 404 or redirect; cannot edit another owner's listing             |           |       |
| 97  | Attempt direct API call to edit another owner's listing via the browser network tab                                    | Returns 401 or 403; not a 200                                    |           |       |

---

## Perspective 4 — Admin

> A platform administrator managing claims, entities, content, and operations. Tests every admin route for access, data rendering, and core actions.

### 4-A: Admin Access Control

| #   | What to do                                                                | Expected                                                                  | Pass/Fail | Notes |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------- | ----- |
| 98  | Navigate to `/admin` while signed in as the test admin                    | Admin dashboard loads                                                     |           |       |
| 99  | Navigate to `/admin` while signed in as a non-admin user (test supporter) | Redirected away (403 page or account redirect); admin content not visible |           |       |
| 100 | Navigate to `/admin` while not signed in                                  | Redirected to `/sign-in?next=/admin`                                      |           |       |

---

### 4-B: Admin Route Coverage

Test each admin route loads without a runtime error or blank screen:

| #   | Route                                                   | Expected                                     | Pass/Fail | Notes |
| --- | ------------------------------------------------------- | -------------------------------------------- | --------- | ----- |
| 101 | `/admin`                                                | Dashboard overview with stat cards           |           |       |
| 102 | `/admin/entities`                                       | Table of all listings with pagination        |           |       |
| 103 | `/admin/entities/[id]` (any real entity ID)             | Entity detail with all fields                |           |       |
| 104 | `/admin/claims`                                         | Claims queue table                           |           |       |
| 105 | `/admin/claims/[id]` (any real claim ID)                | Claim detail with approve/reject actions     |           |       |
| 106 | `/admin/collections`                                    | Collections list                             |           |       |
| 107 | `/admin/collections/new`                                | New collection form                          |           |       |
| 108 | `/admin/collections/[id]/edit` (any real collection ID) | Edit collection form pre-populated           |           |       |
| 109 | `/admin/guides`                                         | Guides list                                  |           |       |
| 110 | `/admin/guides/new`                                     | New guide form                               |           |       |
| 111 | `/admin/blacqlight`                                     | BLACQLight articles list                     |           |       |
| 112 | `/admin/blacqlight/new`                                 | New article form                             |           |       |
| 113 | `/admin/receipts`                                       | Receipts queue                               |           |       |
| 114 | `/admin/marketplace`                                    | Marketplace admin view                       |           |       |
| 115 | `/admin/analytics`                                      | Platform analytics dashboard                 |           |       |
| 116 | `/admin/reviews`                                        | Reviews queue                                |           |       |
| 117 | `/admin/verification`                                   | Verification queue                           |           |       |
| 118 | `/admin/reports`                                        | Reports/audit page                           |           |       |
| 119 | `/admin/ai-tools`                                       | AI Tools page; shows "Mock mode" status card |           |       |

---

### 4-C: Claim Workflow (Admin Side)

| #   | What to do                                                                          | Expected                                                                   | Pass/Fail | Notes |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------- | ----- |
| 120 | Create a test claim as the supporter account; then sign in as admin                 | Claim appears in `/admin/claims` queue                                     |           |       |
| 121 | Navigate to `/admin/claims/[id]` for the test claim                                 | Claim details render: listing name, claimant email, documents if attached  |           |       |
| 122 | Approve the claim                                                                   | Claim status updates to "approved"; listing ownership assigned to claimant |           |       |
| 123 | Verify the claimant (test owner account) can now see the listing in their dashboard | Listing appears in `/dashboard/pages`                                      |           |       |
| 124 | Create a second test claim; reject it as admin                                      | Claim status updates to "rejected"                                         |           |       |

---

### 4-E: Content Management

| #   | What to do                                       | Expected                                                                   | Pass/Fail | Notes |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------- | --------- | ----- |
| 125 | Create a new collection with at least 2 listings | Collection saved; appears in `/collections` on the public site             |           |       |
| 126 | Edit the collection name                         | Edit saved; collection shows updated name publicly                         |           |       |
| 127 | Create a new BLACQLight article as a draft       | Article saved with "draft" status; does not appear on public `/blacqlight` |           |       |
| 128 | Publish the BLACQLight article                   | Article appears on public `/blacqlight` page                               |           |       |

---

## Perspective 5 — Mobile User

> Tests the full anonymous and account experience at 375px width. Use a real iPhone if possible; Chrome DevTools at 375px is acceptable.

### 5-A: Core Mobile Pages

| #   | What to do                                     | Expected                                                                            | Pass/Fail | Notes |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------- | --------- | ----- |
| 129 | Load the homepage at 375px                     | No horizontal scroll; hero text readable; CTA buttons full-width or clearly visible |           |       |
| 130 | Open the mobile navigation                     | Hamburger or menu icon visible; tapping opens a full nav drawer or dropdown         |           |       |
| 131 | Navigate between sections using the mobile nav | Nav closes after selection; correct page loads                                      |           |       |
| 132 | Load a business detail page at 375px           | Business name, category, and CTA visible without horizontal scroll                  |           |       |
| 133 | Tap the CTA button on a business page          | Action triggers correctly; tap target large enough (at least 44px)                  |           |       |
| 134 | Load `/search` at 375px and enter a query      | Search input reachable without zooming; results load                                |           |       |
| 135 | Load `/collections` at 375px                   | Collection cards stack vertically; no overflow                                      |           |       |
| 136 | Load `/pricing` at 375px                       | Plan cards stack vertically; all four plans visible by scrolling                    |           |       |
| 137 | Load `/contact` at 375px                       | Email channel cards stack; all four visible                                         |           |       |

---

### 5-B: Mobile Auth Forms

| #   | What to do                    | Expected                                                                     | Pass/Fail | Notes |
| --- | ----------------------------- | ---------------------------------------------------------------------------- | --------- | ----- |
| 138 | Load `/sign-in` at 375px      | Email and password fields full-width; keyboard opens on tap; no layout shift |           |       |
| 139 | Load `/sign-up` at 375px      | Form readable; submit button reachable without scrolling past keyboard       |           |       |
| 140 | Load `/add-business` at 375px | Multi-step form usable; navigation between steps works; no step overflows    |           |       |

---

### 5-C: Mobile Dashboard

| #   | What to do                                               | Expected                                                        | Pass/Fail | Notes |
| --- | -------------------------------------------------------- | --------------------------------------------------------------- | --------- | ----- |
| 141 | Load `/dashboard` at 375px while signed in as test owner | Dashboard renders; sidebar or bottom nav present; no overflow   |           |       |
| 142 | Navigate to `/dashboard/pages/[entityId]/edit` at 375px  | Edit form renders in single-column layout; all fields reachable |           |       |
| 143 | Load `/account/receipts/new` at 375px                    | Form fully usable; submit button reachable                      |           |       |

---

## Perspective 6 — Accessibility

> Tests keyboard navigation, focus management, ARIA labeling, and screen reader compatibility on the most critical flows. Run in Chrome or Firefox on macOS.

### 6-A: Keyboard Navigation

| #   | What to do                                                                                | Expected                                                                                               | Pass/Fail | Notes |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------- | ----- |
| 144 | Tab through the homepage from the very first focusable element                            | Focus rings visible on every interactive element; tab order logical (header → hero → content → footer) |           |       |
| 145 | Tab to the search bar on the homepage and press Enter                                     | Search action triggers                                                                                 |           |       |
| 146 | On a business page, tab to the Save button and press Enter or Space                       | Save action triggers                                                                                   |           |       |
| 147 | Tab through the `/sign-in` form; fill in fields and submit with Enter                     | Form submits without using a mouse                                                                     |           |       |
| 148 | Tab through the `/sign-up` form end to end                                                | All fields and the submit button reachable by keyboard                                                 |           |       |
| 149 | On any page with a dropdown or Select input, navigate and select an option using keyboard | Dropdown opens with Enter/Space; arrow keys move options; Enter selects                                |           |       |
| 150 | Tab to the footer; reach all active links                                                 | All active footer links are focusable; inactive "coming soon" spans are NOT in tab order               |           |       |

---

### 6-B: Focus Management

| #   | What to do                                           | Expected                                                                  | Pass/Fail | Notes |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------- | --------- | ----- |
| 151 | Open the mobile nav with keyboard or click; close it | Focus returns to the element that triggered the open                      |           |       |
| 152 | Open a modal or confirmation dialog; press Escape    | Dialog closes; focus returns to trigger element                           |           |       |
| 153 | Submit a form with a validation error                | Focus moves to the first error field or error summary; error is announced |           |       |
| 154 | Complete a form submission successfully              | Success message announced; focus set to confirmation or next step         |           |       |

---

### 6-C: ARIA and Labels

| #   | What to do                                                                                         | Expected                                                              | Pass/Fail | Notes |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------- | ----- |
| 155 | Inspect all icon-only buttons on the page (save button, share button, social icons) in the browser | Each has an `aria-label` or `title` describing the action             |           |       |
| 156 | Inspect all images with content (hero images, listing photos, logos)                               | Each has a non-empty `alt` attribute; decorative images have `alt=""` |           |       |
| 157 | Inspect all form inputs on `/sign-in`, `/sign-up`, and `/add-business`                             | Every input has an associated `<label>` or `aria-label`               |           |       |
| 158 | Trigger a validation error on any form                                                             | Error message has `role="alert"` or appears in an `aria-live` region  |           |       |

---

### 6-D: Color Contrast

| #   | What to do                                                            | Expected                                                                        | Pass/Fail | Notes |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- | ----- |
| 159 | Use browser accessibility inspector (or axe DevTools) on the homepage | No contrast failures on primary text (brand-black on white/cream/pale-lavender) |           |       |
| 160 | Check amber-gold text on white or pale-lavender backgrounds           | `#E2A428` on white — verify passes 4.5:1 for normal text size                   |           |       |
| 161 | Check charcoal text on white                                          | `#595758` on `#FFFFFF` — verify passes WCAG AA                                  |           |       |
| 162 | Check white text on brand-black and deep-bg                           | Passes WCAG AA                                                                  |           |       |

---

## Perspective 7 — Security

> Tests authentication gates, admin boundaries, and cross-user data isolation. Requires direct URL manipulation and basic browser network tools.

### 7-A: Auth Gates

| #   | What to do                                                                  | Expected                                                 | Pass/Fail | Notes |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------- | --------- | ----- |
| 163 | Open a fresh incognito window; manually navigate to `/dashboard/pages`      | Redirected to `/sign-in?next=/dashboard/pages`           |           |       |
| 164 | Open a fresh incognito window; manually navigate to `/account/settings`     | Redirected to `/sign-in?next=/account/settings`          |           |       |
| 165 | Open a fresh incognito window; manually navigate to `/account/receipts/new` | Redirected to `/sign-in`                                 |           |       |
| 166 | Open a fresh incognito window; navigate to `/admin/claims`                  | Redirected to `/sign-in?next=/admin/claims`              |           |       |
| 167 | Sign in as the test supporter (non-admin) and navigate to `/admin`          | Redirected or shown 403 — admin dashboard not accessible |           |       |
| 168 | Sign in as the test supporter and navigate to `/admin/entities`             | Same — redirected or 403                                 |           |       |

---

### 7-B: Cross-User Data Isolation

| #   | What to do                                                                                                   | Expected                                                 | Pass/Fail | Notes |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------- | ----- |
| 169 | Sign in as Supporter A; save 3 businesses. Sign in as Supporter B; navigate to `/account/saved`              | Supporter B sees their own saves only; not Supporter A's |           |       |
| 170 | Sign in as Supporter A; submit 2 receipts. Sign in as Supporter B; navigate to `/account/receipts`           | Supporter B sees their own receipts only                 |           |       |
| 171 | Get the UUID of a receipt owned by Supporter A; attempt to access it via URL as Supporter B                  | 404 or redirect; receipt data not returned               |           |       |
| 172 | Sign in as Owner A; get their `entityId`. Sign in as Owner B; visit `/dashboard/pages/[ownerAEntityId]/edit` | 404 or redirect; Owner B cannot edit Owner A's listing   |           |       |

---

### 7-C: Sensitive Data Exposure

| #   | What to do                                                                 | Expected                                                                      | Pass/Fail | Notes |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------- | ----- |
| 173 | On any public page, open the browser network tab and inspect API responses | No user emails, user IDs, or `auth.users` data in any public response body    |           |       |
| 174 | View the page source of any public listing page                            | No service role key, Supabase secrets, or other environment variables present |           |       |
| 175 | On the `/account/community-spend` page, open the browser console           | No "SUPABASE_SERVICE_ROLE_KEY is not set" error; no stack trace in console    |           |       |
| 176 | Inspect the public community spend API response or page render             | Individual user receipts not identifiable; only anonymized totals shown       |           |       |

---

### 7-D: Input Validation

| #   | What to do                                                                                                          | Expected                                                                          | Pass/Fail | Notes |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------- | ----- |
| 177 | In the business name field of Add Business, enter `<script>alert('xss')</script>`                                   | Field either rejects the input or renders the raw string escaped — no alert fires |           |       |
| 178 | In any text area, enter 10,000 characters and submit                                                                | Either length validation shown, or the DB truncates safely; no server error       |           |       |
| 179 | Attempt to submit the add-business form via direct API call (using curl or Postman) with an unauthenticated request | 401 returned; listing not created                                                 |           |       |

---

## Perspective 8 — Performance and Core Web Vitals

> Tests page load speed, perceived performance, and Vercel Analytics compatibility. Use Chrome DevTools Lighthouse or PageSpeed Insights.

### 8-A: Core Web Vitals Targets

| #   | Page                      | Target LCP | How to measure                                               | Pass/Fail | Notes |
| --- | ------------------------- | ---------- | ------------------------------------------------------------ | --------- | ----- |
| 180 | Homepage                  | < 2.5s     | Lighthouse in Chrome DevTools; mobile preset                 |           |       |
| 181 | Business detail page      | < 2.5s     | Lighthouse in Chrome DevTools; mobile preset                 |           |       |
| 182 | Discover / search results | < 2.5s     | Lighthouse; note if SSR is working (content in initial HTML) |           |       |
| 183 | Sign-in page              | < 1.5s     | Lighthouse; this page has no images                          |           |       |

---

### 8-B: Image Loading

| #   | What to do                                | Expected                                                                                            | Pass/Fail | Notes |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- | --------- | ----- |
| 184 | Load a business page with a cover image   | Image loads using Next.js `<Image>` with lazy loading; no `<img>` tags loading full-size originals  |           |       |
| 185 | Load the `/discover` page                 | Listing card images load progressively; page does not wait for all images before rendering text     |           |       |
| 186 | Check image file sizes in the Network tab | No single image over 1MB downloaded by the browser (Next.js should optimize via its image pipeline) |           |       |

---

### 8-C: Server-Side Rendering

| #   | What to do                                      | Expected                                                                                                      | Pass/Fail | Notes |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------- | ----- |
| 187 | View the page source of the homepage            | Hero text, navigation links, and footer are present in the HTML source — not rendered only after JS hydration |           |       |
| 188 | View the page source of a business page         | Business name, category, and city are in the HTML source                                                      |           |       |
| 189 | View the page source of the search results page | Search results are in the HTML source if query is in URL params                                               |           |       |

---

### 8-D: Analytics Event Tracking

| #   | What to do                                                                         | Expected                                                        | Pass/Fail | Notes |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------- | ----- |
| 190 | Load a business page; check the Network tab for requests to `/api/analytics/event` | Analytics ping sent with correct event type                     |           |       |
| 191 | Click the Save button; check the Network tab                                       | A `save` or equivalent event fires to the analytics endpoint    |           |       |
| 192 | Check Vercel Analytics in the Vercel dashboard after test runs                     | Page view events appearing; no errors in the analytics pipeline |           |       |

---

## Perspective 9 — Content and Data Quality

> Tests that the site is using real seed data and not displaying mock content, empty states, or placeholder text at launch.

| #   | What to check                          | Expected                                                                                             | Pass/Fail | Notes |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- | ----- |
| 193 | Homepage featured listings             | Real business names, real cities, real categories — not "Business 1", "Test Corp", "Mock Restaurant" |           |       |
| 194 | Discover page first 20 listings        | All listings have: name, city, category. No "undefined" or null values visible                       |           |       |
| 195 | 5 random business pages                | Each page has: description, at least one image or graceful fallback, real contact or CTA data        |           |       |
| 196 | `/collections` index page              | At least one published collection exists; it has listings inside                                     |           |       |
| 197 | Seed data city count                   | At least 150 Atlanta listings, 50 Houston listings, 50 Chicago listings are live                     |           |       |
| 198 | `/about` page                          | No `[PLACEHOLDER]` or `TODO` text visible to users                                                   |           |       |
| 199 | `/privacy`, `/terms`, `/cookies` pages | Legal notice banner present; content is present; no blank sections                                   |           |       |
| 200 | Footer                                 | Copyright year says 2026; no "Lorem ipsum" text anywhere                                             |           |       |

---

## Perspective 10 — Cross-Browser

> Run the P0 smoke tests on the top 3 browsers used by the target audience.

| #   | Browser                                  | Test                                              | Expected                                          | Pass/Fail | Notes |
| --- | ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------- | --------- | ----- |
| 201 | Chrome (latest)                          | Homepage, business page, sign-in, save action     | All function correctly                            |           |       |
| 202 | Safari (latest, macOS)                   | Homepage, business page, sign-in, save action     | All function correctly; no layout breaks          |           |       |
| 203 | Firefox (latest)                         | Homepage, business page, sign-in                  | All function correctly                            |           |       |
| 204 | Safari on iOS (real device or simulator) | Homepage, business page, sign-in form, mobile nav | All function correctly; keyboard behavior correct |           |       |
| 205 | Chrome on Android                        | Homepage, save action, mobile nav                 | All function correctly                            |           |       |

---

## Launch Gate Scorecard

Complete this table before approving soft launch. All P0 and P1 items must PASS.

| Perspective           | P0 items                                                                         | P1 items                              | Status |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------- | ------ |
| 1 — Anonymous Visitor | Tests 1, 7–9 (404 pages), 32–34 (auth gates)                                     | All remaining                         |        |
| 2 — New Supporter     | Tests 38–40 (sign-up + email)                                                    | All remaining                         |        |
| 3 — Business Owner    | Tests 95–97 (ownership boundary)                                                 | Tests 67–70, 71–76 (edit flow)        |        |
| 4 — Admin             | Tests 98–100 (admin access)                                                      | Tests 101–119 (all admin routes load) |        |
| 5 — Mobile            | Tests 129–131 (homepage + nav at 375px)                                          | Tests 138–143                         |        |
| 6 — Accessibility     | Tests 144–148 (keyboard nav on primary flows)                                    | Tests 155–158 (ARIA/labels)           |        |
| 7 — Security          | Tests 163–168 (auth gates), 169–172 (data isolation), 175 (no service key error) | Tests 177–179 (input validation)      |        |
| 8 — Performance       | Tests 180–181 (LCP < 2.5s)                                                       | Tests 187–189 (SSR)                   |        |
| 9 — Content Quality   | Tests 193–197 (real data, seed count)                                            | Tests 198–200                         |        |
| 10 — Cross-Browser    | Tests 201, 204 (Chrome + Safari iOS)                                             | Tests 202–203, 205                    |        |

**Soft launch approval requires:**

- [ ] All P0 items: PASS
- [ ] No P1 items with FAIL and no documented remediation plan
- [ ] Tests 60, 175 specifically confirmed PASS (community spend service key fix verified)
- [ ] Seed data thresholds confirmed: 150 ATL, 50 HOU, 50 CHI

---

## Known Gaps to Accept at Soft Launch

The following are known limitations at MVP. Document them here as accepted risks, not blocking failures:

| Gap                                                                    | Risk level                                     | Accepted by | Notes                                            |
| ---------------------------------------------------------------------- | ---------------------------------------------- | ----------- | ------------------------------------------------ |
| Business page may show mock data if slug does not match a real listing | Low — only affects malformed URLs              |             | Real listings will have correct URLs             |
| Email delivery via Resend not verified in staging                      | Medium — sign-up flow untested end to end      |             | Verify Resend domain in production before launch |
| Stripe not connected — paid plan CTAs go to waitlist                   | Low — expected at MVP                          |             | All CTAs correctly route to sign-up or waitlist  |
| Anthropic AI not connected — AI suggestions page shows placeholder     | Low — expected at MVP                          |             | Page renders correctly with checklist only       |
| Algolia not connected — search uses Supabase full-text                 | Medium — search may be slower on large dataset |             | Monitor search P95 via monitoring plan           |
| No automated test suite                                                | Medium — relies entirely on manual testing     |             | Automated tests are a post-launch priority       |
