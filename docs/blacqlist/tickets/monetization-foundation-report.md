# Monetization Foundation — Build Report

**Date:** 2026-05-11  
**Status:** Complete — pending Stripe wiring

---

## What Was Built

### Docs

| File                                               | Description                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `docs/blacqlist/monetization/monetization-spec.md` | Full spec: tier matrix, add-on products, later revenue streams, data model, Stripe integration approach |

### Database Migration

**`supabase/migrations/20260511000003_monetization_foundation.sql`**

| Change                       | Type              | Notes                                                                                                     |
| ---------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| `plans.plan_key` column      | Additive          | Nullable `text`, partial unique index. Gives plans stable slugs (`free`, `starter`, `growth`, `premium`). |
| `subscriptions` table        | New placeholder   | Owner-scoped subscription record. No Stripe wiring yet. RLS: owner can read own row.                      |
| `sponsored_placements` table | New placeholder   | Tracks spotlight and boost placements per listing. RLS: service role only for now.                        |
| `sponsor_campaigns` table    | New placeholder   | Tracks brand sponsorship inquiries and campaigns. RLS: service role only.                                 |
| `set_updated_at()` function  | CREATE OR REPLACE | Shared trigger function; safe if already existed.                                                         |

### Frontend Routes

| Route                | File                                 | What it is                                                                                 |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `/pricing`           | `app/(public)/pricing/page.tsx`      | Full rebuild: 4-tier plan comparison, add-ons, FAQ, sponsor teaser, CTA                    |
| `/for-sponsors`      | `app/(public)/for-sponsors/page.tsx` | Expanded: who sponsors, how it works, placement options, CTA                               |
| `/dashboard/upgrade` | `app/dashboard/upgrade/page.tsx`     | Authenticated placeholder: shows current plan (Free), 4-tier cards with "Coming Soon" CTAs |

### Components Modified

| File                                        | Change                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `components/dashboard/DashboardSidebar.tsx` | Added `Sparkles` icon import and `{ href: "/dashboard/upgrade", label: "Upgrade", icon: Sparkles }` nav item |

---

## Permission Model

| Surface                | Access               | Notes                                                       |
| ---------------------- | -------------------- | ----------------------------------------------------------- |
| `/pricing`             | Public               | Static page, no auth required                               |
| `/for-sponsors`        | Public               | Static page, no auth required                               |
| `/dashboard/upgrade`   | Authenticated owners | Protected by `requireOwner()` in `app/dashboard/layout.tsx` |
| `subscriptions` reads  | Owner only (RLS)     | `auth.uid() = user_id` SELECT policy                        |
| `sponsored_placements` | Service role only    | No public/owner read policy until rendering is implemented  |
| `sponsor_campaigns`    | Service role only    | Admin UI required before reads are needed                   |

---

## What Is NOT Implemented

| Item                                      | Reason                                                   |
| ----------------------------------------- | -------------------------------------------------------- |
| Stripe Checkout session creation          | No payment provider configured yet                       |
| Subscription lifecycle webhooks           | Depends on Stripe wiring                                 |
| Subscription enforcement (feature gating) | No active subscriptions exist; all users are Free        |
| `plan_key` seed data for `plans` table    | Requires running a seed script or Supabase Studio insert |
| Admin UI for sponsor campaigns            | Deferred; admin dashboard is incomplete                  |
| Marketplace transaction fees              | Deferred until checkout flows exist                      |
| BLACQ Boost activation flow               | Deferred; only displayed on pricing/for-sponsors pages   |

---

## Next Recommended Tickets

1. **Seed `plans` table with 4 tiers** — insert rows with `plan_key`, pricing, and feature JSON. Depends on pricing being finalized.
2. **Choose and configure Stripe** — requires API keys added to `.env.local` and production. All `stripe_*` fields in `subscriptions` are ready.
3. **Stripe Checkout integration** — server action to create a Checkout session; webhook handler for `checkout.session.completed` and subscription events.
4. **Subscription enforcement** — server-side check for `subscriptions.status = 'active'` before granting access to paid-tier features (verified badge, analytics, etc.).
5. **Sponsor campaign intake form** — replace `mailto:` CTA on `/for-sponsors` with a real inquiry form that inserts into `sponsor_campaigns`.
6. **Admin: sponsor campaigns view** — read `sponsor_campaigns` in admin dashboard; update status from `inquiry` to `proposal` / `active`.
7. **Sponsored placements rendering** — query `sponsored_placements WHERE status = 'active' AND ends_at > now()` and render on homepage/city/category pages.
