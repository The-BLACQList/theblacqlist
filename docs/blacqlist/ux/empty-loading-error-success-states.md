# Empty, Loading, Error, and Success States — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** UX / Frontend
**Audience:** Designers, Engineers, QA

---

## Purpose

This document defines the four UI states for every significant screen and data-dependent interaction in The BLACQList. Every screen that fetches data, accepts input, or performs an action must have all four states designed before implementation begins. A component that only handles the happy path is incomplete. This document closes that gap.

---

## State Definitions

- **Empty state:** No data exists yet for the current context, or a query returned zero results. The screen is working correctly — there is simply nothing to show.
- **Loading state:** Data is being fetched, or an action is being processed. The user is waiting. The interface must communicate that work is in progress.
- **Error state:** Something failed — a network timeout, a server error, a validation failure, or a permission denial. The user must be told what went wrong and what to do next.
- **Success state:** An action completed or data loaded as expected. The user must be told that what they tried to do worked.

---

## Empty State Principles

- Every empty state must include a heading, a body sentence, and a primary action. A blank section is never acceptable.
- Distinguish between three distinct empty conditions: "nothing created yet" (new user, no data exists), "query returned nothing" (filter or search matched zero records), and "load failed" (treated as an error state, not an empty state — do not conflate them).
- The heading should name what is missing. The body should explain why and what to do. The action should take the user somewhere useful.
- An empty state on a list or table that returns nothing after a filter is applied must include a "Clear filters" action. Do not leave the user in a filtered dead end.
- Empty states in admin interfaces must give the admin a path to create or seed data — they should not feel like errors.

---

## Loading State Principles

- Use skeletons for any content with known structure — listing cards, stat cards, table rows, gallery grids, profile sections. The skeleton must match the layout of the loaded state. Do not use a generic gray block.
- Use a spinner only for operations with unknown duration where no structural preview is possible — for example, a form submission, an image upload, or a confirm action.
- Never show a blank screen or blank section while loading. The page layout must not shift when content resolves.
- Buttons that trigger async operations must be disabled and show a spinner inline for the duration of the operation. This prevents double-submission.
- If a loading operation exceeds five seconds, show an explanatory message: "This is taking longer than usual. Still working..." Do not leave the user staring at a spinner with no feedback.

---

## Error State Principles

- All error messages must be written in plain language. Never expose HTTP status codes, stack traces, database error messages, or technical identifiers to end users.
- Every error must name what went wrong and tell the user what to do next. "Something went wrong" alone is not sufficient — it must be followed by an action.
- Distinguish recoverable errors (try again, correct input, sign in) from terminal errors (contact support, account suspended). The recovery action must match the error type.
- Preserve user input on all validation errors. Never reset a form when a submission fails. The user should be able to correct only what is wrong.
- Inline validation errors appear below the affected field, not at the top of the form. Field-level error text uses plain language: not "Invalid value" but "Enter a valid email address."

---

## Success State Principles

- Every significant user action must produce visible confirmation. Silent success is a UX failure.
- Use a toast notification for small, in-context actions: saving a listing, copying a link, removing an item. Toast duration: 3 seconds for informational confirmations, persistent (requires dismissal) for anything the user must acknowledge before continuing.
- Use a dedicated success screen or success state for critical multi-step completions: onboarding complete, claim submitted, listing published for the first time, email verified.
- The success confirmation must name what happened ("Your claim has been submitted") and tell the user what comes next ("We'll review it within 48 hours. Check your email for confirmation.").
- After a form submission that creates a record, navigate to or surface that record so the user can see the result immediately.

---

## 1. Homepage States

### 1.1 Featured Listings Section

| State   | Condition                                                             | Heading                           | Body copy                                 | Action / Component                                                                                                                                                       |
| ------- | --------------------------------------------------------------------- | --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty   | No listings have been admin-curated for the homepage featured section | "Featured listings coming soon"   | "We're curating our first picks for you." | Hide section or show a subtle placeholder — do not surface this to public users; treat as admin task                                                                     |
| Loading | Featured listing cards are fetching on page load                      | —                                 | —                                         | Skeleton: 6 listing cards at their standard aspect ratio — cover image block, name line, category + city line, save button placeholder. Matches the loaded grid exactly. |
| Error   | Featured listings API call fails                                      | "Featured listings couldn't load" | "Try refreshing the page."                | Retry link (triggers re-fetch)                                                                                                                                           |
| Success | Cards load                                                            | —                                 | —                                         | 6–8 listing cards render with cover images, names, categories, cities, and save buttons                                                                                  |

### 1.2 City Spotlight Section

| State   | Condition                          | Heading | Body copy | Action / Component                                                                                                       |
| ------- | ---------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Loading | City spotlight content is fetching | —       | —         | Skeleton: city name line + category pill row (6 pill-sized rectangles). Full-width layout preserved.                     |
| Error   | City spotlight fetch fails         | —       | —         | Section collapses gracefully — hide the section entirely rather than showing an error banner for a supplementary element |
| Success | Content loads                      | —       | —         | Featured city name + category pill row with click-through to `/city/[city-slug]/[category-slug]`                         |

Note: The city spotlight section has no meaningful empty state from the user's perspective. If no city is configured, the section does not render. This is an admin configuration responsibility, not a user-facing empty condition.

### 1.3 Collections Section (V1 feature, but states defined now)

| State   | Condition                              | Heading                 | Body copy | Action / Component                                                                                        |
| ------- | -------------------------------------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| Empty   | No collections have been published yet | Do not show the section | —         | Section hidden until at least one published collection exists                                             |
| Loading | Collections are fetching               | —                       | —         | Skeleton: 3 collection cards at standard aspect ratio — cover image block, title line, listing count line |
| Error   | Collections fetch fails                | —                       | —         | Section collapses — hide rather than showing an error for a supplementary element                         |
| Success | Collections load                       | —                       | —         | 3–6 collection cards render with cover images, titles, and listing counts                                 |

### 1.4 Dollar-Flow Teaser

No states required. At MVP this is a static visual mock — no data fetch. At V3 it becomes data-driven, at which point states will be defined in the V3 planning artifacts.

---

## 2. Search Results States

### 2.1 Initial State — No Query Entered

| State             | Condition                                                   | Heading                | Body copy                                                       | Action / Component                                                                                                                                     |
| ----------------- | ----------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empty (pre-query) | User navigates to `/search` with no query or filter applied | "Search The BLACQList" | "Find Black-owned businesses, services, and more in your city." | Search bar in focus with city selector. Below: popular category pills ("Restaurants", "Hair & Beauty", "Wellness", "Bookstores", "Fashion", "Finance") |

### 2.2 Search Results Loading

| State   | Condition                                             | Heading | Body copy | Action / Component                                                                                                                                                                                                              |
| ------- | ----------------------------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | User has submitted a query; results are being fetched | —       | —         | Skeleton: result count line (short rectangle) + 8–12 listing card skeletons in the standard grid. Each skeleton: image block + name line + category + city line + save button stub. Filter bar remains visible and interactive. |

### 2.3 No Results — Query Returned Zero

| State | Condition                             | Heading                    | Body copy                                                   | Action / Component                                            |
| ----- | ------------------------------------- | -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Empty | Query returned zero matching listings | "No results for '[query]'" | "Try a different search term, or browse by category below." | "Clear search" text button + row of category pill suggestions |

### 2.4 No Results — All Filters Applied Returned Zero

| State | Condition                                                             | Heading                          | Body copy                                    | Action / Component                                                                                                      |
| ----- | --------------------------------------------------------------------- | -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Empty | Active filters (city + category + trust status) returned zero results | "No listings match your filters" | "Try removing a filter to see more results." | "Clear all filters" button (Amber Gold); individual filter chips with × for removal are visible in the filter bar above |

### 2.5 Search API Failure

| State | Condition                                  | Heading                          | Body copy                                       | Action / Component                     |
| ----- | ------------------------------------------ | -------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Error | Search API call fails (network error, 500) | "Search isn't working right now" | "We're looking into it. Try again in a moment." | "Try again" button (retries the query) |

### 2.6 Results Loaded (Success)

| State   | Condition              | Heading | Body copy                                                                    | Action / Component                                                                                       |
| ------- | ---------------------- | ------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Success | Query returned results | —       | "[N] results[in [City]][for '[query]']" — inline result count, not a heading | Listing card grid with cover images, names, categories, cities, claimed/verified badge, and save buttons |

### 2.7 Autosuggest / Typing State

At MVP, no autosuggest dropdown is defined. The search bar accepts keyboard input and submits on Enter or button tap. A "Search" button is always visible and tappable. Autosuggest (matching business names, categories, and cities inline as the user types) is a V1 enhancement.

---

## 3. BLACQList Page States

### 3.1 Page Loading

| State   | Condition                                             | Heading | Body copy | Action / Component                                                                                                                                                                                                                                                                                                                                                           |
| ------- | ----------------------------------------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | Page is server-rendering or ISR data is being fetched | —       | —         | Skeleton layout: full-width cover image block (fixed height, Charcoal tone) + name line (large) + tagline line (medium) + CTA button stub. Below: about text block (3 lines) + contact card grid (2×2 blocks) + gallery grid (3 image stubs). Quick-actions bar stub is fixed at the correct position. The skeleton preserves the page layout so no shift occurs on resolve. |

### 3.2 Listing Not Found

| State       | Condition                                           | Heading                    | Body copy                                                        | Action / Component                                                    |
| ----------- | --------------------------------------------------- | -------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Error (404) | The slug does not match any listing in the database | "This page doesn't exist." | "The listing you're looking for may have moved or been removed." | "Search The BLACQList" → `/search`; secondary: "Go to Homepage" → `/` |

This renders via `not-found.tsx` at the `[listing-slug]` route segment. It is styled on-brand, not a generic browser 404.

### 3.3 Listing Unpublished or Taken Down

| State           | Condition                                                                       | Heading                                | Body copy                                            | Action / Component                                                                                                          |
| --------------- | ------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Error (removed) | The listing exists but has `status = unpublished` or `status = flagged_removed` | "This listing is no longer available." | "It may have been removed or taken down for review." | "Explore more in [category] in [city]" → `/city/[city-slug]/[category-slug]`; secondary: "Search The BLACQList" → `/search` |

This is a distinct state from not-found. The listing record exists — the owner or admin took it offline. Do not render a 404 for this condition.

### 3.4 Page Fully Loaded (Success)

| State   | Condition            | Heading | Body copy | Action / Component                                                                                                                                                                                                                                                     |
| ------- | -------------------- | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success | All page data loaded | —       | —         | Full page renders: cover image, business name, tagline, trust badge, primary CTA button, quick-actions bar (Save, Share, Directions, Call), About section, contact and hours card, social links, services list, gallery grid, breadcrumb. No skeleton elements remain. |

### 3.5 Gallery Loading (Partial)

The hero section of the BLACQList Page is server-rendered and appears immediately. The gallery section (up to 12 images) may load after the hero if images are fetched independently.

| State                  | Condition                                                              | Action / Component                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading (gallery only) | Gallery images are still being fetched after the page frame is visible | Gallery grid shows 6–12 image skeleton blocks at the correct aspect ratio. The rest of the page is fully visible and interactive.                                                                        |
| Error (gallery only)   | Gallery image fetch fails                                              | Inline within the gallery section: "Gallery couldn't load. [Try again]" — plain text link that retries the fetch. Does not affect any other section of the page. Full-page error state is not triggered. |

### 3.6 Save Button States

| State                                      | Icon / Button appearance                                        | User sees                                                                                                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unsaved                                    | Heart outline icon (white or Charcoal)                          | "Save" label or heart icon only (context-dependent: label on desktop cards, icon-only on mobile quick-actions bar)                                                                                                                                                     |
| Saving                                     | Spinner replaces icon briefly                                   | Button is disabled during the save request. No label change.                                                                                                                                                                                                           |
| Saved                                      | Heart filled (Amber Gold)                                       | "Saved" label or filled heart icon                                                                                                                                                                                                                                     |
| Save error                                 | Heart outline returns (Amber Gold border to signal the attempt) | Toast: "Couldn't save. Try again." — 5 seconds, with a "Retry" text action inline                                                                                                                                                                                      |
| Unsaving                                   | Spinner briefly                                                 | Button disabled during unsave request                                                                                                                                                                                                                                  |
| Auth required (anonymous user clicks Save) | Heart outline unchanged                                         | Sign-in modal appears (not a full-page redirect). Modal heading: "Sign in to save listings." Subheading: "Keep track of the Black-owned businesses you love." Primary CTA: "Sign in" → `/sign-in?next=[current-page-url]`; secondary: "Create an account" → `/sign-up` |

### 3.7 Trust Badge States

| State         | Badge appearance                                  | What the user sees                                                                                                                                                                                 |
| ------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unclaimed     | Gray/Charcoal badge: "Unclaimed"                  | Tooltip or label on hover/tap: "This listing hasn't been claimed by its owner yet. [Know this business? Share the page.]" — share link only, not a direct claim prompt (to avoid confusion at MVP) |
| Claimed       | Amber Gold badge: "Claimed"                       | The owner has verified this is their business.                                                                                                                                                     |
| Pending claim | Amber Gold outline badge: "Claim pending"         | Visible to admin only in admin view. Public users see "Unclaimed" until the claim is approved.                                                                                                     |
| Verified (V1) | Amber Gold solid badge with checkmark: "Verified" | Tooltip: "This business has been verified by The BLACQList team."                                                                                                                                  |

---

## 4. City Landing Page States

### 4.1 Listings Loading

| State   | Condition                              | Heading | Body copy | Action / Component                                                                                                                                                            |
| ------- | -------------------------------------- | ------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading | Page is fetching listings for the city | —       | —         | Skeleton: city name + stats line at top, then a grid of 8–12 listing card skeletons. Category pill row at the top is rendered immediately (static from the categories table). |

### 4.2 City Exists — No Listings Yet

| State | Condition                                                            | Heading                     | Body copy                                                                                 | Action / Component                                                                     |
| ----- | -------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Empty | City slug is valid but no published listings exist for this city yet | "No listings in [City] yet" | "We're just getting started here. Be the first to add your business, or check back soon." | "Add Your Business" → `/add-business`; secondary: "Explore other cities" → `/discover` |

This is a transitional state for newly activated cities. At public launch with Atlanta, Houston, and Chicago seeded, this state will not appear for those cities.

### 4.3 City + Category Filter — No Results

| State | Condition                                                      | Heading                                | Body copy                                                                   | Action / Component                                                                             |
| ----- | -------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Empty | City has listings but the active category filter returned zero | "No [Category] listings in [City] yet" | "This category is growing. Check back, or browse all businesses in [City]." | "Browse all in [City]" → `/city/[city-slug]`; secondary: "Add your business" → `/add-business` |

### 4.4 City Slug Not Found

| State       | Condition                                | Heading                    | Body copy                                                      | Action / Component                                                    |
| ----------- | ---------------------------------------- | -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Error (404) | City slug does not match any city record | "We're not in [city] yet." | "The BLACQList is expanding. Explore the cities we're in now." | "Explore all cities" → `/discover`; secondary: "Go to Homepage" → `/` |

At MVP, redirect an unknown city slug to `/discover` rather than rendering a 404 page. This is friendlier for users who type a city name manually in the URL.

### 4.5 City Page Loaded (Success)

| State   | Condition                             | Heading | Body copy | Action / Component                                                                               |
| ------- | ------------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------ |
| Success | City record found and listings loaded | —       | —         | City name, stat line ("[N] Black-owned businesses"), category pill row, listing grid with cards. |

---

## 5. Collections States

### 5.1 Collections Index Page

| State   | Condition                          | Heading                        | Body copy                                                          | Action / Component                                                                                          |
| ------- | ---------------------------------- | ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Loading | Collections are fetching           | —                              | —                                                                  | Skeleton: page title line + 6 collection card skeletons (cover image block, title line, listing count line) |
| Empty   | No published collections exist yet | "No collections published yet" | "Our editorial team is curating the first lists. Check back soon." | "Explore by city" → `/discover`; secondary: "Search The BLACQList" → `/search`                              |
| Error   | Collections fetch fails            | "Collections couldn't load"    | "Try refreshing the page."                                         | "Try again" button                                                                                          |
| Success | Collections load                   | —                              | —                                                                  | Grid of collection cards with cover images, titles, descriptions, and listing count badges                  |

### 5.2 Collection Page

| State       | Condition                                                       | Heading                          | Body copy                                                      | Action / Component                                                                                                     |
| ----------- | --------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Loading     | Collection is fetching                                          | —                                | —                                                              | Skeleton: full-width cover image block + title line + editorial intro text (3 lines) + listing card grid (6 skeletons) |
| Error (404) | Collection slug not found                                       | "This collection doesn't exist." | "It may have been removed or renamed."                         | "Browse all collections" → `/collections`; secondary: "Go to Homepage" → `/`                                           |
| Empty       | Collection exists but all linked listings have been unpublished | "[Collection title]"             | "The listings in this collection are temporarily unavailable." | "Explore similar listings" → `/search?category=[collection-category]`; link to homepage                                |
| Success     | Collection loaded                                               | —                                | —                                                              | Editorial header (cover image, title, intro paragraph), listing grid with all member BLACQList Pages rendered as cards |

---

## 6. Auth States

### 6.1 Sign In

| State                       | Condition                                      | Heading                    | Body copy                                                                                                        | Action / Component                                                                                                                        |
| --------------------------- | ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Idle                        | Default form state                             | "Sign in to The BLACQList" | —                                                                                                                | Email input + password input + "Sign in" button + "Forgot your password?" link + "Don't have an account? Sign up" link                    |
| Loading                     | Credentials submitted, request in flight       | —                          | —                                                                                                                | "Sign in" button disabled with inline spinner. Inputs disabled.                                                                           |
| Error — invalid credentials | Email or password incorrect                    | —                          | Inline error below the password field: "Email or password is incorrect."                                         | User corrects fields and resubmits. Do not specify which field is wrong.                                                                  |
| Error — account not found   | Email address has no associated account        | —                          | Inline error below the email field: "No account found with this email. Did you mean to sign up?"                 | Link in error text: "Sign up" → `/sign-up`                                                                                                |
| Error — account suspended   | Account has been suspended by an admin         | —                          | Inline error below the form: "Your account has been suspended. Contact us at support@theblacqlist.com for help." | Support email link                                                                                                                        |
| Error — email not verified  | Account exists but email has not been verified | —                          | Inline notice: "Please verify your email address before signing in. [Resend verification email]"                 | "Resend verification email" triggers re-send and shows: "Verification email sent to [email]."                                             |
| Success                     | Credentials valid                              | —                          | —                                                                                                                | No success message shown to user. Redirect to `?next=` param value, or to `/dashboard` for owners, or to `/account/saved` for supporters. |

### 6.2 Sign Up

| State                        | Condition                                    | Heading               | Body copy                                                                                         | Action / Component                                                                                                                                   |
| ---------------------------- | -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle                         | Default form state                           | "Create your account" | —                                                                                                 | Display name input + email input + password input + "I have a business" checkbox + "Create account" button + "Already have an account? Sign in" link |
| Loading                      | Account creation in flight                   | —                     | —                                                                                                 | "Create account" button disabled with inline spinner                                                                                                 |
| Error — email already in use | Email is registered to an existing account   | —                     | Inline error below email field: "An account with this email already exists. Sign in instead?"     | "Sign in" link in error text → `/sign-in`                                                                                                            |
| Error — password too weak    | Password does not meet strength requirements | —                     | Inline error below password field: "Password must be at least 8 characters and include a number." | User corrects and resubmits                                                                                                                          |
| Error — general server error | 500 or unexpected failure                    | —                     | Error below the button: "Something went wrong creating your account. Try again."                  | "Try again" retries submission with same form values                                                                                                 |
| Success                      | Account created                              | "Check your email"    | "We sent a verification link to [email]. Click it to activate your account."                      | No redirect. Shows a static confirmation state with a "Resend email" link below.                                                                     |

### 6.3 Email Verification

| State                 | Condition                                                    | Heading                               | Body copy                                                           | Action / Component                                                                                                  |
| --------------------- | ------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Loading               | Token is being validated by Supabase Auth                    | "Verifying your email..."             | —                                                                   | Centered spinner                                                                                                    |
| Error — token expired | Verification link has expired (Supabase default is 24 hours) | "This verification link has expired." | "Verification links expire after 24 hours. Request a new one."      | "Resend verification email" button → triggers new email + shows "Email sent" inline confirmation                    |
| Error — token invalid | Token is malformed or already used                           | "This link isn't valid."              | "It may have already been used or the link was copied incorrectly." | "Request a new verification email" → redirects to `/sign-in` where they can trigger a resend if not yet verified    |
| Success               | Token valid, email confirmed                                 | "Email verified!"                     | "Setting up your account..."                                        | Redirect to `/onboarding` for new users; redirect to `/dashboard` or `/account` for returning users who re-verified |

### 6.4 Forgot Password

| State   | Condition                                                                | Heading               | Body copy                                                                    | Action / Component                                              |
| ------- | ------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Idle    | Form ready                                                               | "Reset your password" | "Enter your email and we'll send you a reset link."                          | Email input + "Send reset link" button + "Back to sign in" link |
| Loading | Request in flight                                                        | —                     | —                                                                            | Button disabled with spinner                                    |
| Success | Request processed (always shown, regardless of whether the email exists) | "Check your email"    | "If that email is registered, you'll receive a password reset link shortly." | "Back to sign in" → `/sign-in`                                  |

No error state is shown for an unrecognized email. Revealing whether an email is registered is a security risk.

### 6.5 Reset Password

| State                         | Condition                                          | Heading                  | Body copy                                                                                             | Action / Component                                                     |
| ----------------------------- | -------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Idle                          | Token valid, form ready                            | "Set a new password"     | —                                                                                                     | New password input + confirm password input + "Update password" button |
| Loading                       | Password update in flight                          | —                        | —                                                                                                     | Button disabled with spinner                                           |
| Error — token expired         | Reset link has expired                             | "This link has expired." | "Password reset links expire after 1 hour. Request a new one."                                        | "Request a new reset link" → `/forgot-password`                        |
| Error — passwords don't match | Confirm password field does not match new password | —                        | Inline error below confirm field: "Passwords don't match."                                            | User corrects confirm field                                            |
| Error — password too weak     | Password does not meet strength requirements       | —                        | Inline error below new password field: "Password must be at least 8 characters and include a number." | User corrects                                                          |
| Success                       | Password updated                                   | "Password updated."      | "You can now sign in with your new password."                                                         | "Sign in" → `/sign-in`                                                 |

---

## 7. Onboarding States

### 7.1 Step Loading (Role Check)

| State   | Condition                                                                              | Action / Component                                                                                                         |
| ------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Loading | Session is being validated and user role is being determined on entering `/onboarding` | Centered spinner on a minimal layout (no full nav). No skeleton — this resolves in under 1 second under normal conditions. |

### 7.2 Session Lost Mid-Onboarding

| State | Condition                                                 | Heading                 | Body copy                                      | Action / Component                                                                                                                       |
| ----- | --------------------------------------------------------- | ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Error | Session expires while user is completing onboarding steps | "Your session expired." | "Sign in again to pick up where you left off." | "Sign in" → `/sign-in?next=/onboarding`. Post-auth redirect returns them to the onboarding step they were on (stored in URL or session). |

### 7.3 Step Success

Each step transitions forward on action (no separate "success" screen per step):

- Step 1 (role confirmation): User selects "I'm a supporter" or "I have a business" → advances to step 2 without a success state
- Step 2 (first action): User selects action (search to claim, create listing, or explore) → advances or redirects
- Final step (completion): Dedicated success screen: "You're all set, [Name]." + "Start exploring" → `/discover` or "Go to my dashboard" → `/dashboard`

### 7.4 Skip / Dismiss Onboarding

| State          | Condition                            | User sees                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skip available | User taps "Skip for now" on any step | Redirect to `/discover` for Supporters, `/dashboard` for Owners. Onboarding is marked incomplete. A nudge banner appears once on the dashboard/account on first return: "Finish setting up your account. [Resume]" → `/onboarding`. After the user dismisses the nudge once, it does not appear again. |

---

## 8. Save / Unsave — Global States

This component appears on BLACQList Pages (quick-actions bar + hero) and on listing cards across search results, city pages, and the homepage.

| State                          | Icon / Button appearance                                                                 | User sees                                                                                                                                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unsaved                        | Heart outline (white outline on dark backgrounds, Charcoal outline on light backgrounds) | "Save" label (if space allows) or heart icon only                                                                                                                                                                                                                              |
| Saving                         | Spinner replaces icon briefly                                                            | Button disabled, saving in progress                                                                                                                                                                                                                                            |
| Saved                          | Heart filled (Amber Gold)                                                                | "Saved" label (if space allows) or filled heart                                                                                                                                                                                                                                |
| Save error                     | Heart outline returns                                                                    | Toast (5 seconds): "Couldn't save. Try again." with an inline "Retry" text button                                                                                                                                                                                              |
| Unsaving                       | Spinner briefly                                                                          | Button disabled during unsave                                                                                                                                                                                                                                                  |
| Auth required — anonymous user | Heart outline unchanged                                                                  | Sign-in modal appears. Heading: "Sign in to save listings." Body: "Keep track of the Black-owned businesses you love." Primary CTA: "Sign in." Secondary: "Create an account." Both links carry `?next=[current-page-url]` so the user returns to the same listing after auth. |

The save state is managed optimistically client-side: the heart fills immediately on tap, the server request fires in the background, and an error rolls it back if the request fails.

---

## 9. Claim Flow States

### 9.1 Claim Entry (`/claim`)

| State                      | Condition                                       | Heading                           | Body copy                                  | Action / Component                                                                                                                                                                     |
| -------------------------- | ----------------------------------------------- | --------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle                       | Default form state, no query entered            | "Claim your BLACQList Page"       | "Search for your business to get started." | Search input (name, city) + search button                                                                                                                                              |
| Loading                    | Search results loading as user types or submits | —                                 | —                                          | Skeleton: 3–5 result rows (name line + city/category line + "Claim this listing" button stub) below the search input                                                                   |
| Empty — no results         | Query returned no matching listings             | "We couldn't find '[query]'"      | "Your business might not be listed yet."   | "Add your business" → `/add-business`; secondary: "Try a different search" (resets the input)                                                                                          |
| Error — search API failure | Search call fails                               | "Search isn't working right now." | "Try again in a moment."                   | "Try again" button                                                                                                                                                                     |
| Success                    | Results returned                                | —                                 | —                                          | List of matching listing rows: business name, category, city, thumbnail (if available), "Claim this listing" button per row. Plus "Don't see your business? Add it." → `/add-business` |

### 9.2 Claim Form (`/claim/[listing-id]`)

| State                              | Condition                                                  | Heading                                              | Body copy                                                                                             | Action / Component                                                                                     |
| ---------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Idle                               | Form ready — listing data loaded                           | "Claim [Business Name]"                              | "Tell us how you're connected to this business and we'll review your request within 48 hours."        | Name, email, phone, relationship to business inputs + optional document upload + "Submit claim" button |
| Loading                            | Claim being submitted                                      | —                                                    | —                                                                                                     | "Submit claim" button disabled with spinner                                                            |
| Error — already claimed            | Another user already has an approved claim on this listing | "This listing has already been claimed."             | "If you believe this is an error, contact us at support@theblacqlist.com."                            | Support email link                                                                                     |
| Error — duplicate pending claim    | This user already has a pending claim for this listing     | "You already have a pending claim for this listing." | "We'll notify you by email when it's reviewed. This usually takes 48 hours."                          | "View your claim status" → `/dashboard/claim`                                                          |
| Error — document upload failed     | File upload request failed                                 | —                                                    | Inline error below the upload field: "Upload failed. Check your file size (max 10 MB) and try again." | Retry upload — the rest of the form is preserved                                                       |
| Error — general submission failure | 500 or network error on submit                             | "Claim submission failed."                           | "Your information was not lost. Try submitting again."                                                | "Try again" button. Form values preserved.                                                             |
| Success                            | Claim submitted                                            | "Your claim has been submitted."                     | "We'll review it within 48 hours. Check your email at [email] for a confirmation and updates."        | "Go to your dashboard" → `/dashboard/claim`; secondary: "Go to homepage" → `/`                         |

---

## 10. Add Business (Multi-Step) States

The Add Business flow is 7 steps: Entity type → Basic info → Contact → Category + city → Media → CTA → Preview + publish.

### 10.1 Per-Step States

| Step                       | Loading condition                                     | Idle state                                                                            | Validation error                                         | Step success                                               |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Step 1 — Entity type       | No fetch needed                                       | Radio group: Business / Professional / Creative                                       | None (a selection is always required)                    | Advances to Step 2                                         |
| Step 2 — Basic info        | No fetch needed                                       | Name, tagline, description inputs                                                     | Inline errors per field                                  | Advances to Step 3                                         |
| Step 3 — Contact           | No fetch needed                                       | Phone, email, website, address inputs                                                 | Inline errors per field                                  | Advances to Step 4                                         |
| Step 4 — Category + city   | Category list fetch: skeleton pill row while loading  | Category selector + city selector                                                     | "Select a category" and "Select a city" inline errors    | Advances to Step 5                                         |
| Step 5 — Media             | No fetch until upload                                 | Logo upload + cover image upload (drag or tap)                                        | "Upload failed. Max 10 MB." inline error per upload slot | Advances to Step 6; media is optional, step can be skipped |
| Step 6 — CTA               | No fetch needed                                       | CTA type selector (Book, Order, Call, Visit, Contact) + CTA URL or phone input        | "Enter a valid URL" inline error                         | Advances to Step 7                                         |
| Step 7 — Preview + publish | Preview render: skeleton page layout while assembling | Full BLACQList Page preview in read-only mode + "Publish" and "Save as draft" buttons | —                                                        | See publish states below                                   |

All steps: if the user navigates back, form values are preserved. If the user closes the tab, see draft recovery below.

### 10.2 Publish States (Step 7)

| State                  | Condition                     | Heading                        | Body copy                                                           | Action / Component                                                                                   |
| ---------------------- | ----------------------------- | ------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Loading                | Publish request in flight     | —                              | —                                                                   | "Publish" button disabled with spinner. "Save as draft" also disabled during publish.                |
| Success — published    | Listing created and published | "Your BLACQList Page is live." | "Welcome to the directory. Share your page with your community."    | "View my page" → `/[city-slug]/business/[listing-slug]`; secondary: "Go to dashboard" → `/dashboard` |
| Error — publish failed | Server error during publish   | "Something went wrong."        | "Your page wasn't published. Your information is saved. Try again." | "Try again" button. The draft record exists in the database — data is not lost.                      |

### 10.3 Duplicate Warning State

Triggered before final submission if the platform detects a potential matching listing (same business name + city).

| State              | What user sees                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Duplicate detected | Modal: "A listing with this name already exists in [City]." Preview of the potential duplicate (name, category, thumbnail). Two options: "This is my business — claim it instead" → `/claim/[detected-listing-id]`; "This is a different business — continue creating" → dismisses modal and proceeds with publish |

This modal is the only point at which creation is paused. Dismissing it proceeds with publish. The platform records the `force_create = true` flag on the listing for admin review.

### 10.4 Draft Recovery State

If the user closes the tab mid-flow, form values are saved to localStorage after each field change (autosave on blur from Step 2 onward).

| State                     | What user sees                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Returning after tab close | When user returns to `/add-business`, a banner appears: "You have an unfinished listing. Continue where you left off?" Two options: "Continue" (restores saved values + jumps to last completed step) and "Start over" (clears localStorage draft + resets form). |

---

## 11. Owner Dashboard States

### 11.1 Dashboard Home

| State                              | Condition                                              | Heading | Body copy | Action / Component                                                                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------ | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                            | Dashboard stats are fetching                           | —       | —         | Skeleton: status banner area + 4 stat card skeletons (count line + label line) + page preview card skeleton + quick action button row.                                                                                                              |
| Empty — newly claimed, first login | User's claim was just approved. No analytics data yet. | —       | —         | Claim approved banner: "Your BLACQList Page is live. Start customizing it." Primary action: "Edit your page" → `/dashboard/page/edit`. Stat cards show "—" with "Analytics coming soon" below each. Page completion checklist surfaced prominently. |
| Error — analytics fetch failure    | Stats could not load                                   | —       | —         | Stat cards show "—" with a small "Couldn't load" label + "Retry" text link per card. Page preview and quick actions still render. The failure is scoped to the stats section, not the whole dashboard.                                              |
| Success                            | All data loaded                                        | —       | —         | Status banner (claim status), page preview card, stat cards (views, CTA clicks, saves, shares — last 30 days, shown as "—" at MVP with "Analytics in V1" label), completion checklist, quick action buttons                                         |

### 11.2 Page Editor (`/dashboard/page/edit`)

| State                      | Condition                                                                                  | Heading | Body copy | Action / Component                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| Loading (initial)          | Editor is fetching the current listing data to populate the form                           | —       | —         | Skeleton: section headers + form field rows. Sidebar navigation (section list) renders immediately.                    |
| Autosave — saving          | A field has been changed and 2 seconds have elapsed since last change (debounced autosave) | —       | —         | Inline text in the editor header: "Saving..." (Charcoal, small, Lato)                                                  |
| Autosave — saved           | Autosave request succeeded                                                                 | —       | —         | Inline text: "Saved" (fades after 3 seconds)                                                                           |
| Autosave — unsaved changes | Form has been changed but autosave has not yet fired (within the 2-second debounce window) | —       | —         | Inline text: "Unsaved changes" (Charcoal, small). Persists until save fires.                                           |
| Publish loading            | "Publish" button tapped                                                                    | —       | —         | Button disabled with spinner. Editor inputs remain active.                                                             |
| Publish success            | Listing status changed to `published`                                                      | —       | —         | Toast: "Your page is live." with a "View page" link that opens the BLACQList Page in a new tab                         |
| Publish error              | Publish request fails                                                                      | —       | —         | Toast (persistent): "Couldn't publish. Try again."                                                                     |
| Field validation error     | Section form is submitted with an invalid field                                            | —       | —         | Inline error below the specific field: plain-language message. The section does not save until the error is corrected. |

**Gallery image states per upload:**

| State        | What user sees                                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uploading    | Image thumbnail shows a progress indicator (spinner overlay) + "Uploading..." text below. Other images and UI remain interactive.                                               |
| Uploaded     | Thumbnail renders at full opacity. "Remove" button appears.                                                                                                                     |
| Upload error | Thumbnail shows a red-tinted overlay + "Upload failed. Try again." The user can tap to retry or dismiss the failed item.                                                        |
| Removing     | Remove confirmation: "Remove this photo?" with "Remove" (destructive) and "Cancel" buttons. On confirm: spinner briefly over the thumbnail, then item is removed from the grid. |

### 11.3 Services Manager (`/dashboard/services`)

| State               | Condition                           | Heading                 | Body copy                                               | Action / Component                                                                                                                          |
| ------------------- | ----------------------------------- | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading             | Services list is fetching           | —                       | —                                                       | Skeleton: 3 service row stubs (name line + description line + edit/delete buttons). Add service button is visible but disabled during load. |
| Empty — no services | Owner hasn't added any services yet | "No services added yet" | "Add your first offering so visitors know what you do." | "Add a service" button (Amber Gold, full-width on mobile)                                                                                   |
| Success             | Services loaded                     | —                       | —                                                       | Service list with rows: name, description preview, price (if set), edit + delete actions                                                    |

**Add service inline form states:**

| State  | What user sees                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle   | Form collapsed. "Add a service" button visible.                                                                                                |
| Open   | Inline form expands below the list: service name input + description textarea + price input (optional) + "Save service" button + "Cancel" link |
| Saving | "Save service" button disabled with spinner                                                                                                    |
| Saved  | Toast: "Service added." New service row appears at the bottom of the list. Form collapses.                                                     |
| Error  | Toast (5 seconds): "Couldn't save service. Try again." Form remains open with values preserved.                                                |

**Delete service states:**

| Step         | What user sees                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Tap "Delete" | Confirmation prompt inline on the row: "Delete [service name]?" with "Delete" (Amber Gold, destructive) and "Cancel" buttons |
| Deleting     | Row shows a spinner. "Delete" and "Cancel" replace with a disabled state.                                                    |
| Deleted      | Row is removed from the list. Toast: "[Service name] deleted."                                                               |
| Delete error | Row remains. Toast: "Couldn't delete service. Try again."                                                                    |

---

## 12. Account: Saved Listings States

| State            | Condition                  | Heading                             | Body copy                                                                                | Action / Component                                                                               |
| ---------------- | -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Loading          | Saves list is fetching     | —                                   | —                                                                                        | Skeleton: 6–8 listing card stubs at standard card aspect ratio                                   |
| Empty — no saves | User has no saved listings | "Nothing saved yet"                 | "Browse Black-owned businesses in your city and save the ones you want to come back to." | "Start exploring" → `/discover`                                                                  |
| Error            | Saves list fetch fails     | "Couldn't load your saved listings" | "Try refreshing the page."                                                               | "Try again" button                                                                               |
| Success          | Saves list loaded          | —                                   | —                                                                                        | Listing card grid with saved listings. Each card includes an active (filled) save/unsave button. |

**Unsave from saved list:**

| State          | What user sees                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Tap unsave     | Heart button shows spinner briefly. Item is removed from the list optimistically (immediately).        |
| Unsave success | Item is gone from the list. Toast: "Removed from saved listings." with an "Undo" action for 5 seconds. |
| Unsave error   | Item reappears in the list. Toast: "Couldn't remove. Try again."                                       |

---

## 13. Account: Receipt Upload States

Receipt upload is scoped to MVP Beta. At MVP launch it is intake-only: no OCR pipeline, no spend visualization. States are defined now to prevent ambiguity during implementation.

| State                        | Condition                                       | Heading                      | Body copy                                                                           | Action / Component                                                                                                                                              |
| ---------------------------- | ----------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upload idle                  | Default state — camera/file prompt visible      | "Upload a receipt"           | "Track your spending at Black-owned businesses."                                    | "Take a photo" button (opens device camera, `capture="environment"`) + "Choose from library" button (opens file picker). Both options visible side by side.     |
| Camera / file picker loading | Waiting for device to respond                   | —                            | —                                                                                   | Brief spinner on the button that was tapped. Resolves when device camera or file picker opens.                                                                  |
| OCR processing (V2)          | After image captured — OCR pipeline running     | —                            | "Reading your receipt..."                                                           | Centered spinner + copy. No form fields visible yet.                                                                                                            |
| OCR success (V2)             | OCR returns suggested values                    | "Confirm receipt details"    | "We filled in what we could read. Review and correct anything that looks off."      | Pre-filled form: business name, date, amount, category. Each field is editable. "Submit receipt" button.                                                        |
| OCR failure (MVP beta)       | OCR not yet available, or V2 OCR fails to parse | "Enter your receipt details" | "We couldn't read the receipt automatically. Enter the details below."              | Blank form: business name (text input, required), date (date picker, required), amount (number input, required), category (dropdown, required), optional notes. |
| Form validation errors       | Required fields missing on submit               | —                            | Inline errors per field                                                             | User corrects and resubmits                                                                                                                                     |
| Submitting                   | Receipt form submitted                          | —                            | —                                                                                   | "Submit receipt" button disabled with spinner                                                                                                                   |
| Submit success               | Receipt saved                                   | "Receipt submitted."         | "Thank you for tracking your community spend."                                      | "Upload another receipt" button + "View my receipts" link → `/account/receipts`                                                                                 |
| Submit error                 | Server or network error                         | —                            | Inline below the button: "Submission failed. Your information is safe — try again." | "Try again" button. Form values preserved.                                                                                                                      |
| Receipt history loading      | History list is fetching                        | —                            | —                                                                                   | Skeleton: 5 receipt row stubs (business name line + date + amount)                                                                                              |
| Receipt history empty        | No receipts submitted yet                       | "No receipts yet"            | "Upload your first receipt to start tracking your community spend."                 | "Upload a receipt" button                                                                                                                                       |

---

## 14. Admin States

### 14.1 Admin Overview (`/admin/overview`)

| State                      | Condition                     | Heading | Body copy | Action / Component                                                                                                                                                                                  |
| -------------------------- | ----------------------------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                    | Platform stats are fetching   | —       | —         | Skeleton: 5 stat card stubs (count line + label line) + activity feed row stubs (8 rows)                                                                                                            |
| Error — stat fetch failure | Stats query fails             | —       | —         | Stat cards render with "—" as the value + "Couldn't load" below each. A single "Retry" button at the top of the stats row retries all stat queries. Activity feed shows its own error state inline. |
| Success                    | All stats and activity loaded | —       | —         | Stat strip (Total listings, Active listings, Pending claims, New this week, Total users) + priority action queue rows + recent activity feed                                                        |

**Activity feed error state:** Inline below the feed heading: "Activity feed couldn't load. [Try again]" — link retries the feed fetch only.

### 14.2 Admin Listings Table (`/admin/listings`)

| State                             | Condition                                                             | Heading                           | Body copy                               | Action / Component                                                                              |
| --------------------------------- | --------------------------------------------------------------------- | --------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Loading                           | Table is fetching                                                     | —                                 | —                                       | Skeleton: 10 table row stubs. Filter bar renders immediately. Search input renders immediately. |
| Empty — no listings match filters | Active filters returned zero results                                  | "No listings match these filters" | —                                       | "Clear all filters" button                                                                      |
| Empty — no listings at all        | Database has no listing records (impossible post-launch, but handled) | "No listings yet"                 | "Add the first listing to get started." | "Add a listing" → `/add-business`                                                               |
| Error                             | Query fails                                                           | "Listings couldn't load"          | "Try refreshing."                       | "Retry" button                                                                                  |
| Success                           | Table loads                                                           | —                                 | —                                       | Paginated table with columns: Name, Category, City, Status, Claimed, Created date, Actions      |

**Row action states:**

| Action           | What admin sees                                                                                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flag a listing   | Confirmation inline on the row: "Flag [listing name] for review?" with reason dropdown (Incorrect info / Inactive / Inappropriate content / Duplicate) + "Flag" and "Cancel" buttons. On confirm: status badge updates to "Flagged" inline. Toast: "[Listing name] flagged." |
| Delete a listing | Confirmation modal (not inline, given the severity): "Permanently delete [listing name]? This cannot be undone." with "Delete" (destructive, red) and "Cancel" buttons. On confirm: row removed from table. Toast: "[Listing name] deleted."                                 |

### 14.3 Admin Claims Queue (`/admin/claims`)

| State                     | Condition                         | Heading                      | Body copy         | Action / Component                                                                                                                    |
| ------------------------- | --------------------------------- | ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                   | Claims queue is fetching          | —                            | —                 | Skeleton: 5 claim card stubs                                                                                                          |
| Empty — no pending claims | No claims with `status = pending` | "No claims to review"        | "All caught up."  | No action needed. Link to view all claims with other statuses: "View all claims"                                                      |
| Error                     | Fetch fails                       | "Claims queue couldn't load" | "Try refreshing." | "Retry" button                                                                                                                        |
| Success                   | Pending claims load               | —                            | —                 | List of claim cards: claimant name, listing name + city, submission date, submitted verification info, "Approve" and "Reject" buttons |

### 14.4 Admin Claim Review (`/admin/claims/[id]`)

| State                                | Condition                          | Heading | Body copy | Action / Component                                                                                                                                                       |
| ------------------------------------ | ---------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                              | Claim details are fetching         | —       | —         | Skeleton: claimant info block + listing preview block + document preview area                                                                                            |
| Approve loading                      | Admin taps "Approve"               | —       | —         | "Approve" button disabled with spinner. "Reject" also disabled during operation.                                                                                         |
| Approve success                      | Claim approved                     | —       | —         | Toast: "Claim approved. [Claimant name] is now the owner of [Listing name]. A confirmation email has been sent." Status badge on the claim updates to "Approved" inline. |
| Reject loading                       | Admin taps "Reject"                | —       | —         | "Reject" button disabled with spinner after reason is entered and confirmed                                                                                              |
| Reject success                       | Claim rejected                     | —       | —         | Toast: "Claim rejected. [Claimant name] has been notified." Status badge updates to "Rejected".                                                                          |
| Error — approval or rejection failed | Server error during approve/reject | —       | —         | Toast (persistent): "Action failed. Try again." Buttons re-enable.                                                                                                       |

### 14.5 Admin Receipts Queue (`/admin/receipts`)

| State                       | Condition                                  | Heading                        | Body copy         | Action / Component                                                                        |
| --------------------------- | ------------------------------------------ | ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------- |
| Loading                     | Queue is fetching                          | —                              | —                 | Skeleton: 5 receipt review row stubs                                                      |
| Empty — no pending receipts | No receipts with `status = pending_review` | "No new receipts to review"    | —                 | Link: "View all receipts" (shows approved receipts too)                                   |
| Error                       | Fetch fails                                | "Receipts queue couldn't load" | "Try refreshing." | "Retry" button                                                                            |
| Success                     | Receipts load                              | —                              | —                 | List of receipt rows with business name, submitter, date, amount, a "Review" link per row |
| Mark reviewed loading       | Admin approves or corrects a receipt       | —                              | —                 | "Mark reviewed" button disabled with spinner                                              |
| Mark reviewed success       | Receipt approved                           | —                              | —                 | Toast: "Receipt marked as reviewed." Row status badge updates inline.                     |

### 14.6 Admin Collections (`/admin/collections`)

| State                  | Condition                    | Heading                     | Body copy                         | Action / Component                                                                                         |
| ---------------------- | ---------------------------- | --------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Loading                | Collections list is fetching | —                           | —                                 | Skeleton: 5 collection row stubs                                                                           |
| Empty — no collections | No collections created yet   | "No collections yet"        | "Create your first curated list." | "Create collection" button (Amber Gold)                                                                    |
| Error                  | Fetch fails                  | "Collections couldn't load" | "Try refreshing."                 | "Retry" button                                                                                             |
| Success                | Collections load             | —                           | —                                 | Table of collections: title, listing count, status (draft/published), created date, edit + archive actions |

**Create new collection form states (inline or modal):**

| State  | What admin sees                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Idle   | "Create collection" button visible                                                                                                    |
| Open   | Form: title input + slug input (auto-generated, editable) + description textarea + cover image upload + listing search to add members |
| Saving | "Save" button disabled with spinner                                                                                                   |
| Saved  | Toast: "Collection created." New row appears in the table. Form closes.                                                               |
| Error  | Toast: "Couldn't create collection. Try again." Form remains open with values preserved.                                              |

### 14.7 Admin Users (`/admin/users`)

| State   | Condition                                     | Heading               | Body copy         | Action / Component                                                              |
| ------- | --------------------------------------------- | --------------------- | ----------------- | ------------------------------------------------------------------------------- |
| Loading | Users table is fetching                       | —                     | —                 | Skeleton: 10 table row stubs. Filter bar + search input render immediately.     |
| Empty   | No users found (should not occur post-launch) | "No users found"      | —                 | "Clear filters" if filters are active                                           |
| Error   | Query fails                                   | "Users couldn't load" | "Try refreshing." | "Retry" button                                                                  |
| Success | Table loads                                   | —                     | —                 | Paginated table: display name, email, role badge, status, created date, Actions |

**Role change:**

| Step              | What admin sees                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap "Change role" | Confirmation modal: "Change [user name]'s role from [current role] to [selected role]?" with role dropdown + "Confirm" and "Cancel" buttons |
| Loading           | Modal primary button disabled with spinner                                                                                                  |
| Success           | Modal closes. Toast: "Role updated." Role badge on the user row updates inline.                                                             |
| Error             | Toast (persistent): "Role change failed. Try again." Modal remains open.                                                                    |

**Suspend user:**

| Step          | What admin sees                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap "Suspend" | Confirmation modal: "Suspend [user name]? They will no longer be able to sign in." with "Suspend" (destructive) and "Cancel" buttons. Optional: reason field. |
| Loading       | Modal primary button disabled with spinner                                                                                                                    |
| Success       | Modal closes. Toast: "[User name] suspended." Status badge on the user row updates to "Suspended" inline.                                                     |
| Error         | Toast (persistent): "Suspension failed. Try again." Modal remains open.                                                                                       |

---

## 15. 404 and Error Pages

### 15.1 404 Page (`not-found.tsx` — root level)

Content:

- Headline (Glacial Indifference, large): "This page doesn't exist."
- Body (Lato): "The listing or page you're looking for may have moved, been removed, or never existed."
- Primary CTA (Amber Gold button): "Search The BLACQList" → `/search`
- Secondary link (underlined): "Go to Homepage" → `/`
- Optional: search bar rendered inline on the 404 page so the user can search without navigating away first

Brand treatment: Deep Background (`#19191E`) page, Cream text, Amber Gold CTA. Do not render a plain browser 404.

### 15.2 Global Error Page (`error.tsx` — root level)

Content:

- Headline: "Something went wrong."
- Body: "We hit an unexpected error. Try refreshing the page — most errors clear on their own."
- Primary CTA: "Try again" — triggers `reset()` from the Next.js error boundary to retry rendering
- Secondary link: "Go to Homepage" → `/`

Brand treatment: matches 404 styling for consistency.

### 15.3 Route-Level Error (Within a Page)

Used when a specific section of a page fails while the rest of the page has loaded correctly. This pattern applies to: gallery on a BLACQList Page, the activity feed on the admin overview, a metric card on the dashboard.

Rule: A section-level failure must never trigger a full-page error takeover. Replace the failed section with an inline error state.

Format: Section area renders with: "[Section name] couldn't load. [Try again]" — a plain text message with a retry link. Retrying re-fetches only that section's data.

Example — BLACQList Page gallery failure: The hero, about, contact, and services sections load and display normally. The gallery section renders: "Gallery couldn't load. Try again." as a single line in the gallery area. Clicking "Try again" re-fetches gallery images.

### 15.4 Maintenance Mode (`/maintenance`)

Content:

- Headline: "The BLACQList is down for maintenance."
- Body: "We'll be back shortly. Thank you for your patience."
- Optional: estimated return time if known
- No navigation links (page is a standalone screen)

The maintenance page is served by a Vercel rewrite rule that redirects all traffic to `/maintenance` during a maintenance window. It does not require a database connection to render.

---

## Summary Tables

### Table 1 — Screens With All Four States Confirmed

All screens addressed in this document have explicit definitions for all four states (empty, loading, error, success). The table below flags any screen where a specific state is intentionally omitted and explains why.

| Screen                        | Omitted State                  | Reason                                                                                 |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------- |
| Homepage — dollar-flow teaser | All four states                | Static mock at MVP, no data fetch                                                      |
| Homepage — city spotlight     | Empty state                    | Admin configuration — has no user-facing empty condition                               |
| Forgot password               | Error state                    | Security requirement: email existence is never confirmed or denied                     |
| Admin Claim Review            | Empty state                    | Route requires a valid claim ID — navigating here always resolves to a record or a 404 |
| Maintenance page              | Loading, error, success states | Static page with no data dependency                                                    |
| 404 page                      | Loading, success states        | Only renders when a resource is not found                                              |

No screen in this document has an undefined state that is expected to occur in production.

---

### Table 2 — Global / Shared States

States that appear across multiple screens, triggered by platform-wide conditions.

| State                            | Trigger                                                                                              | Appearance                                                                                                                                                                                                                        | Duration                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Offline banner                   | `navigator.onLine = false`                                                                           | Amber Gold banner at the top of the viewport (above all other content): "You're offline. Some features may not work." No dismiss button — banner disappears automatically when connection returns.                                | Persistent until `navigator.onLine = true`     |
| Session expired                  | 401 response on any authenticated API request                                                        | Toast (persistent, requires dismissal): "Your session expired. Sign in again." Primary action in toast: "Sign in" → `/sign-in?next=[current-url]`. After sign-in, user is returned to the page they were on.                      | Persistent until dismissed or user signs in    |
| Save auth required               | Anonymous user taps Save on any listing                                                              | Sign-in modal (not full redirect). Heading: "Sign in to save listings." Body: "Keep track of the Black-owned businesses you love." Primary CTA: "Sign in." Secondary: "Create an account." Both carry `?next=[current-page-url]`. | Until dismissed or user completes auth         |
| Generic API error toast          | 500 response or network timeout on any request not covered by a screen-specific error state          | Toast: "Something went wrong. Please try again."                                                                                                                                                                                  | 5 seconds                                      |
| Form autosave indicator          | Field blur on `/dashboard/page/edit` after a change is detected                                      | Inline text in editor header: "Saved" (Charcoal, small, Lato). Fades after 3 seconds. While saving: "Saving..."                                                                                                                   | 3 seconds for "Saved" confirmation             |
| Copy link success                | User taps "Copy link" share button on any BLACQList Page                                             | Toast: "Link copied!"                                                                                                                                                                                                             | 2 seconds                                      |
| Admin queue badge                | Pending claims exist in the claims queue                                                             | Red count badge on the "Claims" sidebar nav item in the admin shell. Updates in real-time on the current session (polling every 60 seconds at MVP; WebSocket in V1).                                                              | Persistent while claims are pending            |
| Duplicate warning (Add Business) | Potential duplicate detected before publish                                                          | Modal overlay on Step 7 of the Add Business flow. Content defined in section 10.3 above.                                                                                                                                          | Until user makes a choice (claim vs. continue) |
| Upload progress (global)         | Any file upload in progress (gallery images, logo, cover image, receipt photo)                       | Progress indicator on the specific upload element — not a global overlay. Each upload tracks independently.                                                                                                                       | Duration of upload                             |
| Role permission denied           | User attempts to access a route their role cannot access (e.g., supporter navigates to `/dashboard`) | Redirect to `/account`. No error message shown. The route simply does not exist for that role. No 403 page for role mismatches — use redirect silently.                                                                           | Immediate redirect                             |
