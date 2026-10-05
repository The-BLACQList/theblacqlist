# Ticket 122: Opening-soon covers for Marketplace, Jobs and The Collective

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** none
**Gates:** GATE-DEPLOY (no migration)

---

## Why

Marketplace, Jobs and The Collective are built but not ready for the public. The Collective takes real receipt uploads today. The founder asked on 2026-10-05 for covers on all three so people don't use them before they're ready.

Founder answers:
- The Collective cover closes all of it: the map, receipt upload, My spending, the account panel, and the homepage band buttons.
- Covers show a teaser and a waitlist. Nav links stay, with a "Soon" pill.

## How it works

- Three flags in `lib/env.ts`: `marketplaceOpen`, `jobsOpen`, `collectiveOpen` (`FEATURE_MARKETPLACE_OPEN`, `FEATURE_JOBS_OPEN`, `FEATURE_COLLECTIVE_OPEN`). Off in production unless set, on in Previews and dev.
- `lib/features/opening-soon.ts` lists each feature's pages, APIs, waitlist source and teaser copy.
- `proxy.ts` rewrites covered pages to `/soon/<feature>`. The address bar keeps the link people followed. Covered APIs answer `403 FEATURE_NOT_OPEN`.
- `/soon/<feature>` redirects to the real page once the feature is open, so a shared cover link still works later.
- `createReceiptSubmission` and `updateReceiptSubmission` refuse on their own, so the cover can't be skipped with a direct call.
- Opening a feature is an env change plus a redeploy. No code change.

## Acceptance criteria

- Given a flag is off, when someone visits a covered page, they see "{name} isn't open yet.", a short list of what it will do, and a "Tell me when it opens" waitlist.
- Covered pages:
  - Marketplace: `/marketplace/*`, `/vendors/*`
  - Jobs: `/jobs`, `/add-job`, `/{city}/job/*`
  - The Collective: `/flow-map/*`, `/account/receipts/*`, `/account/spending`, `/account/community-spend`
- `/api/flow-map/*` and `/api/community-spend` return 403 with `code: FEATURE_NOT_OPEN` while The Collective is covered.
- Waitlist signups land in `launch_subscribers` with source `soon-marketplace`, `soon-jobs` or `soon-collective`.
- The cover page is `noindex`, and covered pages drop out of the sitemap.
- Nav links stay and show a "Soon" pill: The Collective in the header and mobile nav; Jobs, Marketplace, The Collective and Post a Job in the footer; the Support panel on the homepage; Receipts, My spending and The Collective in the account nav.
- The homepage Impact band swaps its buttons and live stats for a waitlist.
- The account overview hides the two Collective stats, shows "Opening soon" on the Collective rows, and swaps the Collective panel for a short opening-soon panel.
- Given a flag is on, every page, link and stat comes back as before.

## Left open on purpose

- `/for-vendors`: it already says selling isn't open and has its own vendor waitlist.
- `/api/receipts/[id]/signed-url` and admin approve/reject: `/admin/receipts` uses them. Receipts already submitted stay as they are.
- `/api/marketplace/cta-click`, the marketplace create actions, and owner dashboard Products and Services. These are the offerings on a listing page, and selling is already blocked by plan tier.

## QA notes

- Unit: `tests/opening-soon.test.ts` pins which paths are covered, which aren't (`/jobsite`, `/for-vendors`, the admin receipt route), that each source is in the subscribe allowlist, and that each covered route exists.
- E2E: `e2e/opening-soon.spec.ts` probes the server and runs the covered or the open branch. To see the covers locally: `FEATURE_COLLECTIVE_OPEN=false FEATURE_JOBS_OPEN=false FEATURE_MARKETPLACE_OPEN=false pnpm dev`, then run the spec against it.
- The homepage and sitemap are ISR, so they pick up a flag change on the redeploy that a flag change needs anyway.
- Check 375px and 1280px on the cover, the Impact band and the account overview.
