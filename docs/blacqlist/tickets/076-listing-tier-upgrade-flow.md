# Ticket 076: Listing tier upgrade flow — Stripe Checkout and Customer Portal (/dashboard/billing)

---

## Status

Draft

## Phase

Phase 14: Monetization and Sponsorship Foundation

## Priority

P3 — Low

## Estimate

L (4–8h)

## Feature Area

Monetization

---

## Context

Business owners can upgrade their listing from the Free tier to Standard or Premium to unlock additional features (enhanced gallery, priority search placement, featured badge, AI optimization). This ticket implements the upgrade flow: the billing page in the owner dashboard, the Stripe Checkout session creation, and the Stripe Customer Portal for self-service subscription management.

The flow is: owner views `/dashboard/billing` → clicks "Upgrade to Standard/Premium" → Server Action `createCheckoutSession` creates a Stripe Checkout Session and returns the hosted checkout URL → browser redirects to Stripe's hosted checkout → on success, Stripe fires a webhook that Ticket 078 handles to update the subscription and listing tier → owner is redirected back to `/dashboard?upgrade=success`.

**Stripe Connect is not involved here.** This is standard Stripe subscription billing for the platform, not marketplace vendor payouts. Stripe Connect is V2.

Sources: `docs/blacqlist/architecture/architecture-decisions.md` ADR-007; `docs/blacqlist/architecture/server-actions-plan.md` § spend/marketplace (Server Action for Checkout); `docs/blacqlist/data/database-schema-plan.md` § Commerce.

---

## User Story

As a business owner, I want to upgrade my listing tier directly from my dashboard, so that I can unlock premium features and higher visibility without contacting support.

---

## Scope

**In scope:**

- `app/dashboard/billing/page.tsx` — Server Component; authenticated Owner-only; renders pricing comparison and current subscription status
- Pricing comparison card: three columns (Free, Standard, Premium); feature list per tier from `plans.features`; current tier highlighted; Upgrade buttons for Standard and Premium (disabled if already on that tier or higher)
- Current subscription status card: plan name, billing period, next renewal date, "Manage subscription" button
- `lib/actions/billing/createCheckoutSession.ts` — Server Action; creates a Stripe Customer (if not exists) or retrieves existing customer; creates a Stripe Checkout Session with `mode: 'subscription'`, `success_url: /dashboard?upgrade=success`, `cancel_url: /dashboard/billing`; returns the session URL
- `lib/actions/billing/createPortalSession.ts` — Server Action; retrieves the Stripe Customer ID from `subscriptions`; creates a Stripe Billing Portal session; returns the portal URL
- On success redirect (`/dashboard?upgrade=success`): display a success toast/banner "Your listing has been upgraded to [tier]. Changes are live now."
- Loading states: Upgrade button shows a spinner while `createCheckoutSession` is processing
- Stripe Customer creation/retrieval: if `subscriptions.stripe_customer_id` is null (free-tier owner), create a new Stripe Customer with `email = user.email` and `metadata.listing_id = listingId`; store the Customer ID in the `subscriptions` table before creating the Checkout Session

**Out of scope:**

- Stripe webhook handler (Ticket 078) — this ticket creates sessions; Ticket 078 handles post-payment confirmation
- Displaying invoice history — deferred
- Downgrading tiers (only upgrades at MVP) — self-service downgrade via Customer Portal
- Proration handling — Stripe handles this automatically with the Checkout Session
- Stripe Connect — V2 only

---

## Dependencies

| Dependency                                                                                     | Type                | Status                                                    |
| ---------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| Ticket 075 — Plans and subscriptions tables + Stripe client                                    | Blocking ticket     | Not started                                               |
| Ticket 078 — Stripe webhook handler (must be deployed before Checkout can complete end-to-end) | Soft dependency     | Not started                                               |
| Ticket 050 — Owner dashboard home (dashboard layout)                                           | Blocking ticket     | Not started                                               |
| Ticket 014 — Auth flows                                                                        | Blocking ticket     | Not started                                               |
| Stripe products and prices configured in Stripe Dashboard                                      | External dependency | Must exist; real Price IDs must replace seed placeholders |

**Risk:** End-to-end testing requires Ticket 078 (webhook) to be deployed. The Checkout Session can be created and the redirect can be tested independently; the subscription update after payment requires the webhook. Use Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) to test locally.

---

## UX Notes

- **Screen:** `/dashboard/billing`
- **Layout:** Standard dashboard sidebar layout (Ticket 050); "Billing" as active sidebar nav item
- **Entry points:** Dashboard sidebar nav "Billing" link; "Upgrade" CTA on Dashboard Home (future — not in Ticket 050 scope); post-approval email upsell (future)
- **Exit points:** "Upgrade" → Stripe hosted checkout (external) → `/dashboard?upgrade=success`; "Manage subscription" → Stripe Customer Portal (external) → `/dashboard/billing`

**Pricing comparison layout:**

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Free    │  │ Standard │  │ Premium  │
│  $0/mo   │  │ $19/mo   │  │ $49/mo   │
│          │  │ ★CURRENT │  │          │
│ Feature  │  │ Feature  │  │ Feature  │
│ Feature  │  │ Feature  │  │ Feature  │
│ [Current]│  │ [Current]│  │ [Upgrade]│
└──────────┘  └──────────┘  └──────────┘
```

- Current tier: highlighted with Amber Gold border and a "Current plan" badge
- Upgrade buttons: Amber Gold, disabled (gray + tooltip "This is your current plan") for current and lower tiers
- Downgrade: not available via the upgrade button; "Manage subscription" button handles this via Customer Portal

**Success state:** On redirect to `/dashboard?upgrade=success`, the dashboard renders a dismissable green success banner: "Your listing has been upgraded to [tier]. Changes are live now." (reads the `upgrade` query param; dismisses on click or after 10 seconds).

**Loading state:** When "Upgrade to Premium" is clicked, the button shows a spinner and is disabled; no full-page loader.

**Mobile behavior:** Pricing cards stack vertically (1 column) on 375px; current plan badge remains visible at top of the card.

---

## Design Notes

- **Design brief:** `docs/blacqlist/design/design-brief.md`
- **Components:** shadcn/ui `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`, `Button`, `Badge`, `Separator`
- **Pricing cards:** `Card` with `border-2 border-[#E2A428]` for the current plan; `Card` with `border border-gray-200` for others
- **Current plan badge:** Amber Gold `Badge` with text "Current plan"
- **Upgrade button:** `variant="default"` with Amber Gold background for available upgrades; `variant="outline"` with `disabled` for current and lower tiers
- **Feature list:** `<ul>` with checkmark icon (`lucide-react CheckIcon`) per feature; green checkmark on included features; gray on excluded (crossed out for lower tier features not included at a given tier)
- **Manage subscription card:** below pricing cards; shows plan name, next billing date, and a "Manage subscription →" button (opens Customer Portal)
- **Success banner:** `bg-green-50 border border-green-200 text-green-800`; rendered in the dashboard page layout (not on the billing page)
- **States to implement:** Loading (button spinner), Success (upgrade success banner on `/dashboard`), Error (SA error toast), Disabled (current plan buttons)

---

## Data Notes

- **Data model:** `docs/blacqlist/data/database-schema-plan.md` → `plans`, `subscriptions`, `listings`
- **Entities involved:** `plans`, `subscriptions`, `listings`
- **Operations:**
  - `createCheckoutSession`: SELECT plan by name/id; SELECT subscription by listing_id; conditionally INSERT `subscriptions` (new Stripe Customer) or UPDATE existing `subscriptions.stripe_customer_id`; Stripe API call
  - `createPortalSession`: SELECT subscription by listing_id to get `stripe_customer_id`; Stripe API call
- **Stripe Customer ID storage:** After creating a new Stripe Customer, UPDATE `subscriptions SET stripe_customer_id = $id` before creating the Checkout Session. If the listing has no `subscriptions` row (free tier), INSERT a new row with `status = 'active'`, `plan_id = free_plan_id`, `stripe_customer_id = $newCustomerId`.
- **RLS:** Both Server Actions use authenticated Supabase client with the owner's session. The ownership check verifies `listings.owner_user_id = auth.uid()`.
- **Migration required:** No — tables from Ticket 075.

---

## API Notes

- **Architecture decisions:** `docs/blacqlist/architecture/architecture-decisions.md` ADR-007

**`createCheckoutSession` Server Action:**

```typescript
// Input
{
  listingId: string
  planId: string // UUID of the target plan (Standard or Premium)
}

// Returns on success
ActionResult<{ checkoutUrl: string }>

// The caller redirects to checkoutUrl using next/navigation redirect()
```

**Stripe Checkout Session configuration:**

```typescript
await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId, // existing customer or newly created
  line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?upgrade=success`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
  metadata: {
    listing_id: listingId,
    plan_id: planId,
    user_id: userId,
  },
  subscription_data: {
    metadata: { listing_id: listingId },
  },
})
```

**`createPortalSession` Server Action:**

```typescript
// Input
{
  listingId: string
}

// Returns on success
ActionResult<{ portalUrl: string }>
```

**Error codes to handle:**

| Code                 | Condition                                | User sees                                                           |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `FORBIDDEN`          | Caller does not own the listing          | Toast: "You don't have permission to manage this listing."          |
| `INVALID_PLAN`       | Requested plan does not exist or is free | Toast: "Invalid plan selection."                                    |
| `ALREADY_SUBSCRIBED` | Listing is already on the requested plan | "Upgrade" button is disabled (UX prevents this; SA is a safety net) |
| `STRIPE_ERROR`       | Stripe API returns an error              | Toast: "Couldn't connect to billing. Please try again."             |
| `INTERNAL_ERROR`     | Unexpected DB error                      | Toast: "Something went wrong. Please try again."                    |

---

## Implementation Notes

**Files to create:**

- `app/dashboard/billing/page.tsx` — pricing comparison + subscription status page
- `lib/actions/billing/createCheckoutSession.ts`
- `lib/actions/billing/createPortalSession.ts`
- `components/dashboard/billing/PricingCard.tsx` — individual plan card (name, price, features, CTA button)
- `components/dashboard/billing/CurrentSubscriptionCard.tsx` — shows current plan name, billing period, manage button
- `components/dashboard/billing/UpgradeSuccessBanner.tsx` — success banner rendered on `/dashboard` when `?upgrade=success` is in the URL

**Files to modify:**

- `app/dashboard/page.tsx` — render `UpgradeSuccessBanner` when `searchParams.upgrade === 'success'`
- Dashboard sidebar nav — add "Billing" link
- `lib/errors/codes.ts` — add `INVALID_PLAN`, `ALREADY_SUBSCRIBED`, `STRIPE_ERROR`

**Key patterns:**

- `createCheckoutSession` is a Server Action. After the SA returns `{ data: { checkoutUrl } }`, the Client Component calls `router.push(checkoutUrl)` or uses a `<a href={checkoutUrl}>` link. Do NOT use Next.js `redirect()` inside a Server Action that returns data — return the URL and let the client redirect.
- Ownership check: same pattern as Ticket 073 — query `listings.owner_user_id = auth.uid()`
- Stripe Customer creation: use `stripe.customers.create()` then immediately UPDATE the DB before creating the Checkout Session — this ensures the Customer ID is persisted even if the Checkout Session creation fails
- Feature flags in pricing cards: derive from `plans.features` JSONB array (fetched from DB) — do not hardcode feature lists in the component

**Do not:**

- Implement Stripe Connect — this is explicitly V2
- Show invoice history — deferred
- Trust the `?upgrade=success` URL parameter for subscription state — Ticket 078 (webhook) updates the actual subscription status; the success banner is just UX feedback
- Redirect inside the Server Action with Next.js `redirect()` — return the URL and redirect client-side

---

## Acceptance Criteria

- [ ] Given an owner navigates to `/dashboard/billing`, the pricing comparison renders three plan cards (Free, Standard, Premium) with correct prices and feature lists
- [ ] The owner's current plan card is highlighted with an Amber Gold border and "Current plan" badge
- [ ] "Upgrade" buttons are disabled for the current plan and all plans below it; enabled for plans above the current tier
- [ ] Clicking an enabled "Upgrade" button shows a spinner on the button; calls `createCheckoutSession`; on success, redirects the browser to the Stripe hosted checkout URL
- [ ] Given the Stripe Checkout completes successfully, the owner is redirected to `/dashboard?upgrade=success` and the green success banner is displayed
- [ ] Given the owner clicks "Manage subscription", `createPortalSession` is called; the browser redirects to the Stripe Customer Portal
- [ ] `createCheckoutSession` returns `FORBIDDEN` when called with a listing not owned by the caller
- [ ] `createCheckoutSession` returns `INVALID_PLAN` when called with the free plan ID
- [ ] A new Stripe Customer is created and stored in `subscriptions.stripe_customer_id` if the owner had no Customer ID previously
- [ ] Existing Stripe Customers are reused (no duplicate customer creation on repeated visits to `/dashboard/billing`)
- [ ] Mobile at 375px: pricing cards stack vertically; current plan badge is visible; buttons are full-width

---

## Failure States

| Failure                                           | Condition                                        | User sees                                                                   | Recovery                        |
| ------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------- |
| Stripe API error during checkout session creation | Stripe returns an error                          | Toast: "Couldn't connect to billing. Please try again."                     | Retry by clicking Upgrade again |
| Owner cancels Stripe Checkout                     | User clicks "Cancel" on Stripe's hosted page     | Redirected to `/dashboard/billing`; no toast; billing page renders normally | No action needed                |
| `createPortalSession` fails — no Customer ID      | Owner is on Free and has no `stripe_customer_id` | Toast: "You don't have an active subscription to manage."                   | Upgrade first                   |
| Server error                                      | Unexpected DB error in SA                        | Toast: "Something went wrong. Please try again."                            | Retry                           |
| Invalid plan requested                            | Plan ID not found in `plans` table               | Toast: "Invalid plan selection."                                            | Reload the page                 |

---

## Edge Cases

- Owner already on Premium clicks "Upgrade to Premium" — button is disabled; should never reach the SA; SA returns `ALREADY_SUBSCRIBED` as a safety net
- Owner who previously had a paid subscription and downgraded to Free has a `stripe_customer_id` in the DB — reuse the existing Customer ID when creating a new Checkout Session; do not create a second Stripe Customer
- Stripe Customer creation succeeds but Checkout Session creation fails — the Customer ID is already stored in the DB; on retry, the existing Customer ID is used (no orphaned customers)
- `?upgrade=success` parameter present but Ticket 078 webhook has not yet processed — success banner still shows (it's optimistic UX); the actual subscription status updates asynchronously via webhook
- Multiple browser tabs: owner opens `/dashboard/billing` in two tabs and upgrades in both — the second Checkout will fail at Stripe if the first subscription is already active; Stripe returns an error; SA surfaces `STRIPE_ERROR`

---

## Accessibility Notes

- [ ] Pricing cards have meaningful headings: `<h3>Standard — $19/month</h3>` structure
- [ ] Current plan badge uses `aria-label="Current plan"` in addition to the visual badge
- [ ] Disabled upgrade buttons have `aria-disabled="true"` and a `title` tooltip explaining why they are disabled
- [ ] Feature list items use `<li>` within `<ul>`; checkmark icons are `aria-hidden="true"` (the text label conveys the information)
- [ ] Loading spinner on the Upgrade button: `aria-busy="true"` on the button during loading; `aria-label` updated to "Upgrading, please wait..."
- [ ] Success banner: `role="status"` to announce to screen readers

---

## QA Test Cases

| #    | Scenario                                 | Role              | Steps                                                                                      | Expected result                                                                |
| ---- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| QA-1 | Pricing page renders                     | Owner (Free tier) | Navigate to `/dashboard/billing`                                                           | Free highlighted; Standard and Premium upgrade buttons enabled                 |
| QA-2 | Upgrade flow (Stripe test mode)          | Owner             | Click "Upgrade to Standard"; complete Stripe Checkout with test card `4242 4242 4242 4242` | Redirected to `/dashboard?upgrade=success`; success banner shown               |
| QA-3 | Upgrade button disabled for current plan | Owner (Standard)  | Navigate to `/dashboard/billing`                                                           | Standard "Upgrade" button is disabled with tooltip "This is your current plan" |
| QA-4 | Customer Portal                          | Owner (Standard)  | Click "Manage subscription"                                                                | Redirected to Stripe Customer Portal                                           |
| QA-5 | Stripe Checkout cancelled                | Owner             | Start upgrade; click "Cancel" on Stripe page                                               | Redirected to `/dashboard/billing`; no error shown                             |
| QA-6 | Ownership check                          | Supporter         | Call `createCheckoutSession` with another owner's listing ID                               | Returns `FORBIDDEN`                                                            |
| QA-7 | Mobile at 375px                          | Owner             | Open `/dashboard/billing` at 375px                                                         | Pricing cards stack vertically; CTA buttons are full-width; readable           |

---

## Security Notes

- `STRIPE_SECRET_KEY` is used server-side only; never exposed to the client
- Metadata attached to the Stripe Checkout Session (`listing_id`, `user_id`) is used by the webhook handler (Ticket 078) to update the correct subscription — this is the primary reconciliation mechanism
- Ownership check is mandatory in both Server Actions — do not skip even though the UI prevents cross-listing actions
- `success_url` must use `NEXT_PUBLIC_SITE_URL` env var — do not hardcode domain names

---

## Completion Checklist

- [ ] `app/dashboard/billing/page.tsx` created; renders pricing cards and subscription status
- [ ] `createCheckoutSession` SA implemented; creates Stripe Customer if needed; returns checkout URL
- [ ] `createPortalSession` SA implemented; returns portal URL
- [ ] Pricing cards render correct feature lists from DB
- [ ] Current plan highlighted; upgrade buttons correctly disabled/enabled
- [ ] Upgrade button spinner implemented during SA execution
- [ ] `UpgradeSuccessBanner` rendered on `/dashboard` when `?upgrade=success` is present
- [ ] Ownership check in both SAs
- [ ] New error codes added to `lib/errors/codes.ts`
- [ ] Dashboard sidebar nav includes "Billing" link
- [ ] All acceptance criteria verified
- [ ] TypeScript: zero errors (`tsc --noEmit`)
- [ ] Lint: zero errors (`npm run lint`)
- [ ] Mobile tested at 375px
- [ ] Keyboard navigation tested (pricing cards, buttons)
- [ ] QA test cases passed with Stripe test mode
- [ ] PR opened and linked to this ticket
