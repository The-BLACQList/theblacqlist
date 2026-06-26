# The BLACQList — Project Board

**Trello-ready board covering everything left to build, from MVP public launch to the full "Future of Black Commerce" vision.**

_Last updated: 2026-06-20 · Capacity assumed: Founder + Claude (AI-paced)_

> **Re-baselined 2026-06-20.** The 2026-05-22 manual QA log (123/133 Pass across functional, security, a11y, performance, SEO, and cross-browser) showed the audits were **largely already executed and green** — not a multi-day to-do. That retires most of the MVP's audit-*execution* risk and collapses the audit cards to "finish the report + re-verify on production." Combined with **M4** (editorial collection) and **M9** (seed thresholds) cleared in staging, and **BRM-02** (icon-button labels) already compliant, the MVP pulls in ~1 week: **Jul 18 → ~Jul 11**. The binding constraint is now the **founder-/external-gated** items (legal copy review, production data review, DNS/domain), not engineering.

---

## ⭐ The two finish lines

| Milestone | Target | What it means |
|---|---|---|
| 🚀 **Ready to serve customers** (MVP public launch) | **~Sat Jul 11, 2026** (~3 weeks) | The directory works end-to-end in Atlanta, Houston, Chicago. People can discover, save, claim, and list businesses; admins moderate. |
| 🏁 **Completely done** (full vision) | **~Q2–Q3 2027** (~12 months) | Marketplace + checkout + paid plans, events, jobs, AI agents, **BLACQ Web** (3D commerce-flow map), more cities, and a mobile app — all live. |

> Confidence is **high for the MVP date** (audits executed + green, only report-writing and a production re-verify remain), and **widens for V1–V4**: payments/compliance, real multi-city business data + consent, a production-grade 3D experience, AI agents, and an app-store mobile app each carry external lead times that AI-pacing accelerates on the *build* side but not on the *review/external* side. The MVP floor is now set by the founder-gated items (legal review, data review), not by build work. Re-baseline after each milestone ships.

---

## 🚦 Board lane snapshot — 2026-06-22

Mirror these into Trello's lists. The cards themselves carry the detail; this is the at-a-glance status.

**🚧 In Progress**
- _(open — pick the next card)_

**🔍 In Review / QA**
- `[MVP] 🔴 P0` Security audit (086) — _report written; GO with conditions (prod RLS re-verify · `next` bumped ✅)_
- `[MVP] 🟠 P1` Accessibility audit (087) — _report written; GO with conditions (zero Critical)_
- `[MVP] 🟠 P1` Performance optimization (088) + Lighthouse I1/I3/I4 — _local config + audits done (ISR fixed, images, GIN, `next` bump); only the production Lighthouse run remains_
- `[MVP] 🟠 P1` Incident response + rollback runbook (095) + on-call — _runbook/rollback/support/monitoring docs complete; on-call names founder-gated_
- `[MVP] 🔴 P0` Legal: Privacy & Terms compliance review + reconciliation — _copy reconciled; awaiting attorney sign-off_
- `[MVP] 🟠 P1` Accessibility quick fixes (BRM-01, BRM-02, 098, 097) — _BRM-01/02 done; amber-as-text contrast now fixed; only the 097 save-UX product decision remains_

**⛔ Blocked / Waiting** (founder credentials · DNS lead time · attorney)
> 👉 **Founder:** the ordered list of what *you* set up to unblock these — accounts, domain/DNS, data review, legal confirms, secrets handoff — is in **`docs/blacqlist/launch/founder-action-checklist.md`** (narrative) and **`founder-action-cards.md`** (paste-ready Trello cards F1–F10).
- `[MVP] 🔴 P0` Production data: founder keep/edit/remove pass **✅ applied** (15 closed removed · 87 enriched · 11 verified replacements → ATL 151 / HOU 51 / CHI 51); _remaining: image coverage + production import (093)_
- `[MVP] 🟠 P1` Founder legal confirms: entity name + mailing address + DMCA agent
- `[MVP] 🔴 P0` Supabase production project (091) — _🟢 **schema + reference data live** (38 tables, RLS, 3 buckets, search, reference seed — 2026-06-21); only **auth config + admin user** remain (need the prod domain/deploy), PITR at M7_
- `[MVP] 🔴 P0` Vercel production deploy (092) + domain / DNS / SSL — _**F3 ✅** (Git relinked, MCP, Preview green) · **F9 "set-now" env ✅ 2026-06-24** (4 vars set, build green); **remaining:** F9 **Supabase cutover** → prod project (gated on 091/093) · DNS/SSL (F4) · merge `feat/phase-2-legal-pages` → `main` for a current production build_
- `[MVP] 🔴 P0` Email: Resend — _**✅ wiring done 2026-06-24**: subdomain `send.theblacqlist.com` verified, custom SMTP routes Supabase Auth mail through Resend on **both** projects, sends from domain, DMARC added; **remaining:** deliverability warm-up (lands in spam today — normal for a new domain) → re-verify "inbox, not spam" before F4 go-live_
- `[MVP] 🔴 P0` Production seed import (093)

**🎯 Up Next**
- `[MVP] 🟠 P1` Staging QA: account-deletion end-to-end walk-through — _needs an authed session_
- `[MVP] 🟡 P2` SEO audit (090) — _GSC submission only, post-deploy_
- `[MVP] 🔴 P0` Regression QA sign-off (089) — incl. TA-01–TA-25 + cross-browser L4–L12
- `[MVP] 🔴 P0` Monitoring & alerting (094) + Sentry PII scrubbing — _**F6 founder setup ✅** (source maps verified, DSN set); only K5 prod-error test + alert rule + K7 uptime remain, all post-deploy_
- `[MVP] 🟠 P1` Post-deploy production tests (K4 / K5 / K7 + smoke)
- `[MVP] 🔴 P0` Launch-gate sign-offs (M3, M5, M6, M7, M10)
- `[MVP] 🔴 P0` Soft launch → Go/No-Go → Public announcement

**✅ Done (this stretch)**
- 🙋🏾‍♀️ **Founder F1** — Supabase **production** project created (Pro plan) · 2026-06-21
- 🙋🏾‍♀️ **Founder F2** — domain `theblacqlist.com` confirmed at Bluehost (active, auto-renew, exp Aug 17 2026) · 2026-06-21 _(⚠️ live WordPress site + Google Workspace email on it — F4 DNS cutover is a go-live step)_
- 🙋🏾‍♀️ **Founder F5** — Resend email **wiring complete** · 2026-06-24 (sending subdomain `send.theblacqlist.com` verified · 2 `re_…` keys · custom SMTP on **both** Supabase projects · auth email sends from domain · DMARC added) _(deliverability warm-up before F4 is the only follow-up)_
- 🙋🏾‍♀️ **Founder F6** — Sentry **wiring complete + verified** · 2026-06-24 (org `the-blacqlist`, prod+staging projects, auth token/org/project set → **source-map upload confirmed in the prod build**, `NEXT_PUBLIC_SENTRY_DSN` set both scopes) _(K5 prod-error test + alert rule + K7 uptime are post-deploy, on card 094)_
- 🙋🏾‍♀️ **Founder F9 (partial)** — production env vars **"set-now" batch ✅** · 2026-06-24 (`NEXT_PUBLIC_APP_URL` confirmed + `NEXT_PUBLIC_SITE_URL` + `ADMIN_NOTIFICATION_EMAIL` + `SENTRY_TEST_TOKEN`; build green) _(remaining: the 3 Supabase vars at cutover, gated on 091/093 — see `f9-production-env-handoff.md`)_
- ⚙️ **091 production DB foundation** — 21 migrations + reference data applied to the prod Supabase (38 tables · RLS · 3 buckets · search · states/cities/categories/plans · 0 listings) · 2026-06-21
- BRM-01 / BRM-02 accessibility fixes
- Amber-as-text contrast fix (098: `text-amber-gold` → `text-amber` on light, `text-gold` on dark)
- `next` 16.2.5 → 16.2.6 (clears the security-audit `next` CVE; build + axe green)
- 088 ISR config fixes (homepage 1800, collections/[slug] 3600) + perf local audit
- Legal copy reconciliation (Privacy / Terms / Cookies)
- In-app account deletion
- Seed-review sheet
- M4 (editorial collection) + M9 (seed thresholds) — staging
- **Faceted discovery — ✅ verified on staging** (2026-06-22) — attributes taxonomy + `search_listings_faceted`/`facet_counts` RPCs + faceted sidebar (sort, active chips, mobile sheet, DB-driven categories) + Identity & Ownership facets + `/discover` resilience fix; migrations + attribute data applied, listings reconciled, **32/32 a11y tests green**, filters live on `/discover` (ticket 103)
- **Founder seed-review applied** (2026-06-22) — `seed-review-complete.csv`: 15 closed removed, 87 enriched (addresses/URLs), 11 verified Black-owned replacements → ATL 151 / HOU 51 / CHI 51 (≥ M9); local SQL-seed pruned
- **Collections-editorial migration** (`20260620000000`) applied to staging
- 🙋🏾‍♀️ **Founder F3 — Vercel project connected to GitHub** · 2026-06-23 — Git relinked to the org repo `The-BLACQList/theblacqlist` @ `main` (was the stale personal repo); Vercel MCP access granted; env Preview scopes set; build green.
- **Git reconnect + full product backed up + Preview build green** (2026-06-23) — the entire previously-uncommitted working tree (**287 files**: Pillar A/B, events, 9 migrations, docs, account deletion, BRM a11y) committed (`49f95cb`) + pushed to `feat/phase-2-legal-pages`; **Preview build GREEN** (`✓ 169/169 static pages`, TypeScript clean) at `theblacqlist-git-feat-phase-2-legal-pages-the-blacql-ist.vercel.app`. _Open PR #4 → `main`; merge-to-main + production deploy deferred to a deliberate pass._
- **Pillar B — Listing & Owner Richness** (2026-06-22, _after-launch enhancement track; built tsc/lint clean + a11y green_) — **B1** video · **B3** flexible links · **B4** FAQ accordion · **B5** menu/offerings grouping · **B2a** multi-criteria review ratings (Quality/Service/Value/Atmosphere) · **B2b** moderated review photos (ride the review-publish gate) · **B6** **events as a first-class entity** (`/add-event` → admin review → `/{city}/event/{slug}` page + Event JSON-LD + dashboard editor + "Upcoming events" on organizer business pages + Events discovery filter) · **event polish** (start date on discovery cards + add-to-calendar `.ics`). _Pulls forward big chunks of the V1 "Reviews system" + "Event template" cards (see those cards)._ ⏳ **Staging apply pending — non-blocking:** 4 migrations await a founder paste (`…0004_listing_faqs`, `…0005_review_criteria`, `…0006_review_media_rls`, `…0007_event_entity`); pages render fail-soft before apply. **Not on the MVP critical path.**

> "Done" here means the build/doc work is complete; any production-gated re-verification still lives on the relevant card.

---

## 1) Label system

Trello gives 10 label colors → use them for **Area** (the most useful filter). Encode **Priority** and **Phase** as title prefixes so nothing visually collides.

### Area labels (color)

| Color | Label | Used for |
|---|---|---|
| 🟥 Red | **Compliance / Legal / Privacy** | ToS, privacy policy, cookies, account deletion, data review, DMCA |
| 🟧 Orange | **Content / Data** | Seed listings, business outreach, collections, copywriting |
| 🟨 Yellow | **QA / Testing** | Audits, cross-browser, regression, smoke, Lighthouse |
| 🟩 Green | **Backend / API / DB** | Schema, RLS, server actions, migrations, OCR, billing logic |
| 🟦 Blue | **Frontend / UX** | Pages, components, dashboards, forms, flows |
| 🟪 Purple | **Design / Brand** | Visual system, motion, "Future of Black Commerce" experience |
| ⬛ Black | **Infra / DevOps** | Supabase prod, Vercel, domain/DNS, monitoring, deploy |
| 🟦 Sky | **3D / Interactive** | **BLACQ Web** + WebGL / React-Three-Fiber experiences |
| 🟩 Lime | **AI / Agents** | Concierge, optimization agent, admin curator, OCR/AI |
| 🩷 Pink | **Product / PM** | Roadmap, sign-offs, go/no-go, soft launch |

### Priority — card-title prefix
`🔴 P0` launch blocker · `🟠 P1` important · `🟡 P2` should-have · `⚪ P3` nice-to-have

### Phase — card-title prefix
`[MVP]` · `[V1]` · `[V2]` · `[V3]` · `[V4]`

### Status markers (add when relevant)
`⛔ Blocked` · `⏳ Waiting-external` (DNS, legal, Stripe review, app-store review)

---

## 2) Columns (lists)

| # | List | Holds |
|---|---|---|
| 1 | **📍 Milestones** | Marker cards only — the dated finish lines. Pinned far left. |
| 2 | **🗂️ Backlog** | Everything not in the active window (mostly V1–V4). |
| 3 | **🎯 Up Next** | The current wave's cards. |
| 4 | **🚧 In Progress** | Actively being worked. |
| 5 | **🔍 In Review / QA** | Built, awaiting verification/sign-off. |
| 6 | **⛔ Blocked / Waiting** | Stuck on an external dependency. |
| 7 | **✅ Done** | Complete this phase. |
| 8 | **🚀 Shipped to Production** | Released to users. |

> Use Trello's **filter by label / title** to view one phase at a time. The Milestones list shows the dated ladder.

---

## 3) 📍 Milestones (marker cards)

| Card | Due | Meaning |
|---|---|---|
| 🚀 **MVP Public Launch** | **Jul 11, 2026** | Ready to serve customers — 3 cities, core flows |
| 🤝 **V1 — Trust & Grow** | Sep 12, 2026 | Reviews, trust tiers, more Page templates, Stripe subscriptions, sponsored, supporter dashboard, +cities |
| 🛒 **V2 — Commerce Layer** | Dec 5, 2026 | Marketplace + checkout, receipt OCR, spend dashboards, AI beta |
| 🧠 **V3 — Intelligence (BLACQ Web + Agents)** | Mar 13, 2027 | 3D commerce-flow map, AI concierge/agents, sponsor campaigns, impact analytics |
| 📱 **V4 — Scale** | mid-2027 (rolling) | Mobile app, 25+ cities, Spanish, partner API |
| 🏁 **Full vision complete** | ~Q2–Q3 2027 | "Future of Black Commerce" feature-complete |

### MVP wave breakdown (drives the near-term due dates)

_Re-baselined 2026-06-20: audits collapse from "execute" to "finish report + re-verify on prod," so the waves compress ~1 week and reorder around the founder-/external-gated floor._

- **Wave A — Reports & founder-gated prep (Jun 20–28):** a11y quick fixes ✅, finish audit reports (RLS matrix, OWASP, axe-to-all-37), legal copy → review, **start founder data review** (`seed-review.csv`), Resend DNS, domain.
- **Wave B — Production stand-up + seed (Jun 29 – Jul 5):** Supabase prod, Vercel deploy + env, production data import, Sentry PII + monitoring, PITR/backups.
- **Wave C — Production-only gates & sign-off (Jul 6–9):** post-deploy prod tests (analytics/Sentry/uptime/smoke), regression re-verify + Lighthouse on prod, gate sign-offs, runbooks.
- **Wave D — Soft launch → public (Jul 10–11):** soft launch, go/no-go, ship.

---

## ✅ Already shipped (reference — put in "Shipped to Production")

- Brand refresh (gold/amber palette, Jost/Inter type, node-Q logo, restyled components) · contrast tokens + J12/J13 tests green
- **M1** Privacy live · **M2** Terms live · **M8** no hardcoded localhost
- **M4** ≥1 active editorial collection (staging) · **M9** seed thresholds ATL 251 / HOU 84 / CHI 83 (staging)
- Editorial **Collections** feature (narrative body, per-business blurbs, sections, admin authoring)

---

## 4) Cards

Each card below carries **Labels · Priority · Due**, a **Description** (paste into the Trello card body), and a **Checklist** (the steps).

### 🎯 MVP — Public Launch (due within the 4-week window)

---

**`[MVP] 🔴 P0` Legal: Privacy & Terms compliance review + reconciliation** — _copy reconciled; awaiting attorney sign-off_
🟥 Compliance · **Due Jun 27** · ⏳ Waiting-external (attorney sign-off + founder confirms)

**Description.** Make the live `/privacy`, `/terms`, and `/cookies` pages accurate, defensible, and consistent with our *actual* data flows — what we collect, how it's used, who we share it with — and document user rights and our obligations. (The pages were already substantive, not placeholders, so this became a review + reconciliation rather than a from-scratch write.) Done when the copy is reconciled (done), the founder `[CONFIRM]` inputs are filled (Card A), and a legal counsel / product-owner sign-off is recorded.

**Checklist.**
- ✅ Privacy: data collected (email, profile, business info, receipts, verification docs) — accurate in §2
- ✅ Privacy: how data is used + third parties (Supabase, Stripe, Resend, Vercel, Sentry) with links — §3/§6 (Stripe qualified "when paid features launch")
- ✅ Privacy: GDPR/CCPA user rights + account-deletion process + retained data — §7/§8; **in-app account deletion now built** (`lib/actions/account/deleteAccount.ts`)
- Privacy: verification docs auto-purged 90 days after decision; receipts private to uploader; spend aggregated anonymously — _receipts/spend language ✅ in §4; the **90-day purge is intentionally NOT promised** until the job ships (ticket 101)_
- ✅ Terms: account terms, content guidelines, IP/UGC, conduct, dispute resolution, liability — all 14 sections present
- ✅ DMCA contact + takedown documented — DMCA notice block added to Terms §8 (`notice@theblacqlist.com`); USCO designated-agent registration tracked in ticket 102
- ✅ Both pages live + correct title/meta, footer-linked, mobile-clean — M1, M2 (pages render at `/privacy` + `/terms` + `/cookies`)
- Sign-off recorded (legal counsel or product owner), dated — _pending attorney review_

**Note:** Correction — the pages were **not** placeholders; they were already substantive. This card became a **compliance review + reconciliation**: the live pages were audited against actual data flows and corrected (IP-hashing accuracy, Stripe qualifier, deletion/portability wording, DMCA block, entity/address `[CONFIRM]` placeholders). Full risk-rated findings: `docs/blacqlist/legal/privacy-terms-compliance-review.md`. Remaining blockers: founder `[CONFIRM]` inputs (Card A) + attorney sign-off.

---

**`[MVP] 🟠 P1` Founder legal confirms: entity name + mailing address + DMCA agent**
🟥 Compliance · **Due Jun 27** · ⏳ founder-gated

**Description.** The legal copy is reconciled but carries three founder-only blanks an AI cannot fill: the **legal entity name**, the **mailing address** (controller identity + the CAN-SPAM physical-address norm), and a **DMCA designated agent** registered with the U.S. Copyright Office. These appear as `[CONFIRM: …]` placeholders in Privacy §11 and Terms §8/§14 today. Supplying them clears the last non-attorney blockers on the Legal card. Done when all three are confirmed and their placeholders replaced.

**Checklist.**
- Legal entity name + corporate form confirmed → replace `[CONFIRM: legal entity name]` in Privacy §11 + Terms §14
- Mailing address confirmed → replace `[CONFIRM: mailing address]`
- DMCA designated agent registered with the USCO → replace the `[CONFIRM]` in Terms §8 (ticket 102)
- Hand the reconciled pages to legal counsel / product owner for the Legal-card sign-off

---

**`[MVP] 🟠 P1` Staging QA: account-deletion end-to-end walk-through**
🟨 QA · **Due Jun 28** · ~2h · needs an authenticated session

**Description.** Verifies the new in-app account deletion (`lib/actions/account/deleteAccount.ts` + `app/account/settings/DeleteAccountSection.tsx`) actually does what the Privacy Policy now promises. The relational cascade is verified by code review (FKs: private rows CASCADE, listings/authorship SET NULL); this card is the live end-to-end proof on staging. Done when a throwaway account is deleted and every assertion below holds.

**Checklist.**
- Create a throwaway user; add a save + a receipt + an owned listing
- Run Account → Settings → Delete (type `DELETE`); land on `/sign-in?deleted=1`
- Auth user gone (cannot sign back in); profile / saves / receipt rows removed
- Owned listing **preserved but unclaimed** (`owner_user_id` NULL, not deleted)
- Private storage objects (receipt files) removed; anonymized spend aggregate retained
- Reviews authored by the user removed

---

**`[MVP] 🟠 P1` Accessibility quick fixes (BRM-01, BRM-02, 098, 097)** — _mostly done_
🟦 Frontend · **Due Jun 23**

**Description.** A cluster of small, *known* accessibility defects from the bug-risk log and the 096–098 tickets that are independent of the larger audit and can be fixed immediately: low-contrast muted text, icon-only buttons with no accessible name, and a few brand-color spots to re-verify after the rebrand. Clearing these early shrinks the findings the full accessibility audit (087) will surface. Done when an axe scan reports zero contrast and zero missing-accessible-name violations on the affected screens.

**Checklist.**
- ✅ BRM-01: replaced opacity-based muted text (`text-charcoal/30–70`, all < 4.5:1 on white) with a **tiered AA gray scale** — `text-charcoal-faint` `#737373` (≈4.7:1) and `text-charcoal-soft` `#6b6b6b` (≈5.3:1) — across **143 `.tsx` files** (854 instances). Hierarchy preserved; decorative `/20` and non-text `border/bg/divide-charcoal/*` untouched. `pnpm typecheck` + `pnpm lint` clean.
- ✅ BRM-02: `aria-label` on all icon-only buttons (Save `save-icon-button.tsx`, Share `ShareButton.tsx`, gallery delete/reorder `MediaGrid`/`EntityMediaGallery`, admin actions `OfferingsList`) — verified already compliant, no code change needed; `aria-pressed`/`aria-state` present on toggles
- ✅ 098: **amber-as-text fixed** — `text-amber-gold`→`text-amber` (#8f6600, 5.16:1) on light, `text-gold` on dark, per the design system's own rule (221 swaps + ~30 dark reverts; typecheck/lint clean). _Remaining in 098: pale-lavender-tint near-misses (amber eyebrow 4.29 / charcoal-soft 4.43 / charcoal-/80 3.86) + `text-white/40`-on-dark 3.75 — a design-surface decision (lighten pale-lavender or darker tint tokens). "Claimed" badge still to verify._
- 097: product decision — direct-save vs confirmation modal; implement chosen + announce to screen readers _(separate product decision — still open)_
- axe: zero contrast + zero missing-accessible-name violations _(re-run as part of 087's axe-to-all-37 pass)_

**Note:** BRM-01 darkens a lot of secondary/admin text app-wide — intended, since the prior opacity grays were **failing AA today** (e.g. `/40` ≈ 1.9:1, `/60` ≈ 2.8:1). The change is reversible via git. The broad a11y suite (§J) passed in the 2026-05-22 log but **pre-rebrand**; this card's two contrast/label debts are now cleared, leaving only the 097 save-UX decision and the audit 087 re-verify.

---

**`[MVP] 🔴 P0` Security audit (086)** — _report written; GO with conditions_
🟨 QA · 🟩 Backend · **Due Jun 30** · ~6–8h (auth/IDOR/secret/PII tests passed 2026-05-22; remaining is the full RLS matrix, OWASP checklist, and the written report)

**Description.** A systematic pre-launch pass proving our data-access boundaries actually hold — that RLS policies, auth gates, and API endpoints stop users from reading or changing data they shouldn't. We test every table across roles, probe protected routes and direct API calls for bypass/IDOR, run an OWASP Top 10 review, confirm no secrets reach the client, and verify Sentry captures no PII. A directory holding owners' verification documents can't ship with an unverified access model — hence P0. Done when the report is written, every Critical/High finding is fixed and re-tested, and it carries a written "go."

**Checklist.**
- ✅ RLS matrix: 22 tables × 4 roles (anon / non-owner / owner / admin) — documented in `security-audit-report.md` §1 from the 54 implemented policies + boundary evidence; _condition: per-table re-run on production (091) before launch_
- ✅ Auth-boundary tests (unauthed + role gates) — A1–A10, H7, H8
- ✅ IDOR: direct API access, substituted user IDs, param injection — H1, H2
- ✅ OWASP Top 10 checklist with per-category findings — `security-audit-report.md` §4; incl. fresh `pnpm audit` (→ ✅ **`next` bumped 16.2.5→16.2.6**, build green; remaining are deeper build-chain transitives) + 3 accepted MVP gaps (no CSP / CAPTCHA / virus-scan, each mitigated)
- ✅ Secret-in-bundle check (service role not in client bundle) — H3
- ✅ Sentry PII audit (no email/phone/name/address in events) — K6
- ✅ `security-audit-report.md` written — 0 Critical, 0 launch-blocking High; verdict **GO with conditions** (prod RLS re-verify · `next` bump · accepted MVP gaps); `docs/blacqlist/launch/security-audit-report.md`

**QA evidence (2026-05-22 log):** §A + §H + K6 all Pass. Remaining: full table-by-table RLS matrix, OWASP checklist, and the written report + go/no-go.

---

**`[MVP] 🟠 P1` Accessibility audit (087)** — _report written; GO with conditions (zero Critical)_
🟨 QA · 🟦 Frontend · **Due Jul 1** · ~6–8h (keyboard/VoiceOver/contrast/labels passed 2026-05-22 + BRM-01/02 cleared; remaining is axe-to-all-37 and the written report)

**Description.** A full WCAG 2.1 AA audit and remediation across all 37 MVP screens so the platform is usable by keyboard and screen-reader users — both an inclusion imperative for a community product and a legal-risk reducer. We run automated axe scans, a keyboard-only pass, VoiceOver on the five critical flows, contrast checks, and verify form labels, focus management, and landmarks; fixes ship as small per-category PRs rather than one big change. Done when axe reports zero Critical violations and the five critical flows are completable with VoiceOver + keyboard alone.

**Checklist.**
- ✅ axe scan — **zero Critical** across **21 reachable screens** (extended `e2e/a11y.spec.ts` 5 → 21: all no-login public/auth/legal + admin; 17 tests pass). _~16 owner/account-gated screens need owner/supporter test fixtures (logged in the report as follow-up A-02)_
- ✅ Keyboard-only pass; no traps — J6, J7, J8
- ✅ VoiceOver on 5 critical flows — J9, J10, J11
- ✅ Color contrast (J12/J13 — re-verified against the new palette; tests green post-rebrand)
- ✅ Every input has a real `<label>` — J14
- ✅ Modals trap + return focus; Esc closes — J10, J15
- ✅ Skip link + landmarks — J8
- ✅ Report written — `docs/blacqlist/launch/accessibility-audit-report.md`; **GO with conditions**. One recurring **Serious** finding (amber-as-text `#c4a065` on white = 2.45:1) routed to **ticket 098** (non-blocking — not Critical); BRM-01 resolved 098's muted-text findings; VoiceOver re-verify post-rebrand recommended

**QA evidence (2026-05-22 log):** §J (J1–J15) all Pass — pre-rebrand, but contrast (J12/J13) re-confirmed post-rebrand by our updated tests. Remaining: extend axe to all 37 screens + write the audit report.

---

**`[MVP] 🟠 P1` Performance optimization (088) + Lighthouse I1/I3/I4** — _local items done; Lighthouse re-run on prod remains_
🟨 QA · ⬛ Infra · **Due Jul 6** · ~6–8h (Lighthouse passed staging 2026-05-22; local config + audits done 2026-06-20; remaining is the post-rebrand Lighthouse re-run on production + the `ANALYZE=true` bundle pass)

**Description.** Core Web Vitals are both a UX and a Google ranking signal, so this card brings our key pages within threshold. It covers image optimization (all `next/image`, priority/sizes), correct ISR revalidation windows, bundle trimming (lazy-loaded charts), and database/query checks (search index + `pg_trgm`), then measures five representative pages with Lighthouse on a mobile profile. Slow pages would undercut the SEO-driven growth the product depends on. Done when all five pages hit Performance ≥80 with LCP <2.5s, CLS <0.1, INP <200ms, recorded in `lighthouse-scores.md`.

**Checklist.**
- ✅ Zero raw page `<img>` (all `next/image`; both heroes have `priority`) — I11. _4 `<img>` remain by design: upload-preview overlays with `eslint-disable`, not page renders._
- ✅ ISR `revalidate` **verified + fixed** — homepage **3600→1800**, collections/[slug] **added 3600** (was missing); listing 3600 / city 86400 / sitemap 3600 confirmed (`docs/blacqlist/launch/lighthouse-scores.md`)
- ✅ Lazy-load chart libs — **N/A** (no `recharts`; custom `TrendBar`); `lucide-react` imports all named (0 namespace). _`ANALYZE=true` bundle pass runs against the prod build (gated)._
- ✅ GIN index on `search_vector` + `pg_trgm` confirmed (migration `pg_trgm` L43, `listings_search_vector_idx` L365) — search confirmed working (K9)
- ✅ Lighthouse (mobile) ≥80, LCP<2.5s, CLS<0.1, INP<200ms — passed staging 2026-05-22; _condition: re-run on the production deploy (Vercel/CDN) post-rebrand_

**QA evidence:** §I (I1–I4 Lighthouse, I11 no-img) Pass 2026-05-22 (pre-rebrand) + local config/audit pass 2026-06-20 (ISR fixed, images, named icon imports, GIN index, `next` 16.2.6). **Verdict: GO with conditions** — only the production Lighthouse + bundle pass remain.

---

**`[MVP] 🟡 P2` SEO audit (090)** — _only GSC submission remains_
🟨 QA · **Due Jul 7** · ~3–4h (sitemap/robots/OG/JSON-LD/canonical all passed 2026-05-22; remaining is the post-deploy Google Search Console submission only)

**Description.** Makes the directory discoverable by search engines — the primary way new users will find BLACQList Pages. We verify the sitemap and robots rules, Open Graph/Twitter cards for rich link previews, valid `LocalBusiness` JSON-LD for rich results, canonical URLs, and unique titles, then submit the sitemap to Google Search Console after deploy. Without this, the organic growth the product is built around won't materialize. Done when sitemap/robots/OG/JSON-LD all validate and titles are unique and correctly formatted.

**Checklist.**
- ✅ `sitemap.xml` valid; all 4 URL groups + `lastmod` — I5
- ✅ `robots.txt`: disallow rules + sitemap ref — I6
- ✅ OG/Twitter tags present (title/desc/absolute image/url) — I7, I9, B11, B12
- ✅ JSON-LD `LocalBusiness` valid, zero errors — I8
- ✅ Canonical + unique titles (`[Business] — [City] | The BLACQList`) — I10, B9
- Post-deploy: submit sitemap to Google Search Console + verify domain

**QA evidence (2026-05-22 log):** §I (I5–I10) + §B (B9, B11, B12) all Pass. Remaining: Google Search Console submission (post-deploy only).

---

**`[MVP] 🔴 P0` Production data: founder review + expand to thresholds + images**
🟧 Content/Data · **Due Jul 4** · multi-day · ⏳ founder-gated (sets the MVP floor)

**Description.** A directory is only credible if its listings are real, current, and the businesses are genuinely Black-owned — so before going public the founder reviews the researched seed data for accuracy, closures, and ownership, and we top each city up to threshold with image coverage. This is content work with a real human floor (review + sourcing), and it's P0 because an empty or inaccurate directory destroys trust on day one. Done when ATL ≥150 / HOU ≥50 / CHI ≥50 are published, founder-reviewed, ≥40% with images, and every category has ≥3 listings per city.

**Checklist.**
- Review researched businesses for accuracy / closures / "is it still Black-owned" / consent — **review sheet ready: `docs/blacqlist/data/seed-review.csv`** (265 rows, flagged-first: 130 carry a metro-area / no-website / no-address / duplicate flag; each row has a 1-click Google Maps verify link; README lists per-city category gaps below the ≥3/city threshold) — _founder's manual keep/edit/remove pass still pending (Blocked/Waiting)_
- ✅ Atlanta ≥150, Houston ≥50, Chicago ≥50 published (staging: ATL 251 / HOU 84 / CHI 83) — M9 cleared
- ≥40% with a cover image · every category ≥3 listings/city · descriptions ≥100 chars · CTA non-null
- Run preflight validation SQL; zero gaps

**Note:** thresholds met in **staging** (our seed run). The founder review sheet is generated and regenerable (`scripts/build-seed-review.ts`); "Remove"/"Edit" rows drive a cleanup pass on the seed JSON before the **production** import (card 093). Still pending: the founder's accuracy/consent pass, image coverage, and that prod import.

---

**`[MVP] 🔴 P0` Supabase production project (091)** — _schema + reference data live (2026-06-21); auth-config + admin-user remain (need domain/deploy); PITR at M7_
⬛ Infra · 🟩 Backend · **Due Jul 2** · ~4–6h

**Description.** Stands up the production database as a separate, hardened Supabase project — distinct from staging, on the Pro plan, with point-in-time recovery enabled *before* any data exists (PITR is our only recovery path for a bad migration). We enable connection pooling and the search extension, create the three storage buckets with correct privacy, apply every migration in order, load reference seed data, configure auth, and create the first admin. Every other production card depends on this foundation. Done when migrations are applied, RLS verified, buckets correct, and an admin can reach `/admin`.

**Checklist.**
- ✅ Create `theblacqlist-production` (Pro plan, us-east-1) — **founder F1, 2026-06-21**
- **Enable PITR** (7-day window) **at the M7 launch gate, before public launch** — _deferred during testing (~$100/mo add-on; Pro daily backups cover the empty setup DB)._
- ✅ `pg_trgm` enabled + `listings_search_vector_idx` present _(PgBouncer/session pooler in use for connections)_
- ✅ 3 storage buckets created with correct privacy: `listing-media` (public), `verification-docs` (private), `receipt-uploads` (private) _(note: code path `createReceiptSubmission.ts` references bucket `receipts` — pre-existing naming mismatch to reconcile before receipts go live)_
- ✅ Applied all **21 migrations** in order (incl. `20260620000000_collections_editorial.sql`) — **38 tables, RLS on all, 74 policies** · 2026-06-21
- ✅ Reference seed loaded (`supabase/seed.sql`) — states **51** / cities **13** / categories **191** / plans **3**
- Auth config: Site URL, redirect URLs, JWT 7d, branded email templates — _needs the prod domain/Vercel URL (092)_
- Create admin user; verify `/admin` access; store creds in secrets manager — _do at deploy (needs founder admin email + the app live)_

---

**`[MVP] 🔴 P0` Vercel production deploy (092) + domain / DNS / SSL**
⬛ Infra · **Due Jul 3** · ~2–3h + DNS lead · ⏳ Waiting-external (DNS)

**Description.** Deploys the app to production on the real domain with every environment variable set correctly — the service-role key server-side only, never `NEXT_PUBLIC_*`. Includes registering `theblacqlist.com`, pointing DNS at Vercel, and confirming the auto-provisioned SSL; DNS propagation is the wall-clock dependency, so kick it off early. Done when the production build is live on the domain over HTTPS with `NEXT_PUBLIC_SITE_URL` pointing at it.

**Checklist.**
- All env vars in Vercel production scope (service-role server-only, not `NEXT_PUBLIC_*`)
- Register `theblacqlist.com`; A `@` → Vercel IP; CNAME `www` → `cname.vercel-dns.com`
- SSL auto-provisioned (green lock); `NEXT_PUBLIC_SITE_URL=https://theblacqlist.com`
- Production build succeeds; domain resolves
- Pre-deploy: `git grep` finds no secrets; `.env*` gitignored

---

**`[MVP] 🔴 P0` Email: Resend production domain verification**
⬛ Infra · **Due Jul 2** · 🟡 **wiring ✅ 2026-06-24** (domain verified · SMTP on both Supabase projects · sends from domain · DMARC added) · _remaining: deliverability warm-up → "inbox, not spam"_

**Description.** Transactional email — signup verification, claim notifications, password reset — must actually reach inboxes before launch, which requires verifying our sending domain with Resend via SPF/DKIM/DMARC DNS records. Like the app domain, it carries a DNS-propagation lead time (up to 48h), so it runs in parallel with the domain setup. Done when all three DNS records are green in Resend and a real signup email lands in an inbox (not spam) with a working link.

**Checklist.**
- ✅ Verified **sending subdomain** `send.theblacqlist.com` in Resend (DKIM / SPF / MX green); DMARC `v=DMARC1; p=none;` added _(subdomain keeps Resend SPF/DKIM off the Google-Workspace root SPF)_
- ✅ Two `re_…` keys (prod + preview — Resend has no live/test prefix); `RESEND_FROM_EMAIL=The BLACQList <noreply@send.theblacqlist.com>`
- ✅ Part B: custom SMTP (`smtp.resend.com:465`, user `resend`) enabled on **both** Supabase projects so Auth mail (password reset) sends from the domain
- ⚠️ End-to-end test: reset email **sends from `noreply@send.theblacqlist.com`** ✅ but **lands in spam** today (new-domain reputation) — pending warm-up + "Not spam" before "inbox, not spam" is fully met

---

**`[MVP] 🔴 P0` Production seed import (093)**
🟧 Content/Data · 🟩 Backend · **Due Jul 4**

**Description.** Runs the listing and collection seed scripts against the production database so the directory launches with content. The scripts are idempotent, so this is a safe, repeatable operation; the value is verifying the *production* published counts and image coverage actually meet the launch thresholds (not just staging). Done when the seeds run with zero errors and the per-city counts verify in production.

**Checklist.**
- Run `pnpm seed:launch` against production; verify ATL/HOU/CHI counts via SQL
- Run `scripts/seed-collections.ts` against production
- Errors: 0; idempotent re-run clean

---

**`[MVP] 🔴 P0` Monitoring & alerting (094) + Sentry PII scrubbing**
⬛ Infra · **Due Jul 7** · ~4–5h · _Sentry **code complete + F6 founder setup done** (org `the-blacqlist`, prod+staging projects, source-map upload **verified in prod build 2026-06-24**, `NEXT_PUBLIC_SENTRY_DSN` set both scopes, PII scrubbing 3 tests ✅); remaining = K5 prod-error test + ≥5/5min alert rule + K7 uptime monitors, all **post-deploy**_

**Description.** Gives us eyes on production health from the first minute — error tracking, analytics, uptime checks, and alerts — so we hear about problems before users do. Critically, Sentry PII scrubbing must be configured *before* the first production deploy so we never capture users' emails or phone numbers in error events. Done when Sentry is capturing (PII-free) with alerts wired, Vercel Analytics is on, the health endpoint is live, and three uptime monitors are green.

**Checklist.**
- ✅ Sentry PII scrubbing verified (no PII in events) — K6
- Prod + staging Sentry projects; source maps; alert rule (≥5/5min) — K5 Not Run (needs prod)
- ✅ `/api/health` endpoint live (ok + degraded states) — K1, K2 · Vercel Analytics — K4 Not Run
- 3 uptime monitors (`/`, `/api/health`, `/discover`); alert channels — K7 Not Run (needs prod)

**QA evidence (2026-05-22 log):** health endpoint (K1/K2) + no-PII (K6) Pass. The production monitors (K4 Analytics, K5 Sentry-prod, K7 uptime) are **Not Run** — they require the production deploy first.

---

**`[MVP] 🔴 P0` Regression QA sign-off (089) — incl. TA-01–TA-25 + cross-browser L4–L12**
🟨 QA · **Due Jul 8** · ~6–8h re-verify (full pass executed 2026-05-22, 123/133) · depends on production stand-up + the three audit reports

**Description.** The comprehensive final test pass that proves the whole product works *together* before we ship — the five critical journeys run across Chrome, Safari, and mobile, the role/permission matrix, and the 25 manual test areas (TA-01–TA-25). It runs after the three audits so it tests a near-final build, and it produces the QA sign-off and final go/no-go. This is the gate that catches integration regressions a single-feature test would miss. Done when all critical paths pass in all three browsers, there are zero open P0 bugs, and the report recommends go.

**Checklist.**
- ✅ 5 critical paths × 3 browsers — L1–L15 (B discovery, C add-business, D claim, E dashboard, G admin)
- ✅ Role × flow matrix (anon / supporter / owner / admin) — §A–§G all Pass
- ✅ Functional areas (≈TA-01–TA-25): auth, add-business, search, claim, dashboard, analytics, admin, save/share, legal — §A–§G Pass
- Zero open P0; P1s have written accepted-risk sign-off — _5 P0 gates still open (M3, M5, M6, M7, M10); M4 + M9 since cleared_
- QA sign-off report + final go/no-go — _blocked until those gates close_

**QA evidence (2026-05-22 log):** §A–§G (functional) + §L (cross-browser, L1–L15) all Pass — 123/133 tests. The execution is essentially done; the **sign-off** is what's gated on the remaining production launch gates.

---

**`[MVP] 🟠 P1` Post-deploy production tests (K4 / K5 / K7 + smoke)**
🟨 QA · ⬛ Infra · **Due Jul 7** (post first deploy)

**Description.** A short battery run immediately after the first production deploy to confirm the *live* environment — not just staging — actually works: analytics recording, Sentry capturing a (PII-free, source-mapped) production error, uptime monitors green, and a 10-point smoke test of the core pages. These can only be done against the real deployment, so they gate the soft launch rather than the build. Done when all three integration checks pass and the smoke test is green in under five minutes.

**Checklist.**
- K4: Vercel Analytics records 3+ page views
- K5: Sentry captures a prod error — tagged `environment: production`, source maps readable, zero PII (remove test route after)
- K7: all 3 uptime monitors green; alerts wired
- 10-point smoke test passes in <5 min

---

**`[MVP] 🔴 P0` Launch-gate sign-offs (M3, M5, M6, M7, M10)**
🩷 Product · ⬛ Infra · **Due Jul 9**

**Description.** The operational launch gates that aren't code — the human commitments and evidence the product needs to run safely in production: zero open P0 bugs, a documented ≤48h claim-response SLA with a named owner, a filled-in 30-day on-call rotation, proof PITR is on, and a confirmed Sentry production error. These convert "the software works" into "the team can operate it." Done when all five are documented with evidence and owner sign-off.

**Checklist.**
- M3: zero open P0 in bug-risk log; QA sign-off linked
- M5: claim-queue ≤48h SLA documented + owner named
- M6: on-call rotation filled for 30 days (names/phones/Slack), contacts confirmed
- M7: PITR enabled evidence (screenshot + date)
- M10: Sentry production error confirmed (env tag, no PII, alert fired)

---

**`[MVP] 🟠 P1` Incident response + rollback runbook (095) + on-call** — _docs complete; on-call names founder-gated_
⬛ Infra · 🩷 Product · **Due Jul 8**

**Description.** Before real users depend on the site, the team needs a written plan for when something breaks — severity levels and response SLAs, the escalation chain, and the exact rollback procedures (promote a previous Vercel deploy, reverse an additive migration, or PITR-restore), plus a support playbook for common user issues. This is what turns a 2am outage from panic into a checklist. Done when the runbook covers all three rollback paths and the on-call chain is documented.

**Checklist.**
- ✅ Severity levels + SLAs (SEV1 <15m / SEV2 <1h / SEV3 <24h) — `docs/blacqlist/launch/incident-response-runbook.md` + `on-call.md`
- ✅ Escalation chain (on-call → backup → product lead → all-hands) — runbook §Escalation + `on-call.md`
- ✅ Rollback paths: Vercel promote-previous / additive-migration reverse / PITR restore — `rollback-plan.md` (Scenarios A/B/C) + runbook (Paths A–D) + decision tree
- ✅ Support playbook + post-launch monitoring checklist (24h / week / month) — `support-playbook.md` + `qa/post-launch-monitoring-plan.md`

**Note:** the runbook/rollback/on-call/support/monitoring docs all exist and cover the card. The **on-call rotation names + phone/Slack contacts** in `on-call.md` are intentional `[name]` placeholders — **founder-gated** (overlaps the M6 launch gate); the runbook keeps contacts out of version control by design.

---

**`[MVP] 🔴 P0` Soft launch → Go/No-Go → Public announcement**
🩷 Product · **Due Jul 11**

**Description.** The controlled final step: share the production URL privately with 5–10 trusted testers, fix anything P0/P1 they surface, have the team walk the full journey on mobile, then collect the formal go/no-go sign-offs from Tech, Product, and Legal before announcing publicly. The soft-launch window is our last chance to catch real-world issues with a safety net; the public announcement is the moment we're "serving customers." Done when sign-offs are in and the site is publicly announced.

**Checklist.**
- Share prod URL privately with 5–10 trusted testers; fix all P0/P1 (3–5 days)
- Every team member completes full journey on mobile
- Go/No-Go sign-offs: Tech Lead (infra/security/perf) · Product (features/data) · Legal/Ops (compliance)
- 🚀 **Public announcement**

---

### 🗂️ V1 — Trust & Grow (due ≤ Sep 12, 2026)

---

**`[V1] 🟠 P1` Reviews system** — _⏩ substantially **pulled forward** by Pillar B (2026-06-22)_
🟦 Frontend · 🟩 Backend · **Due ~Aug 22, 2026**

**Description.** Reviews are the trust engine of a directory — they give supporters a reason to return and owners a reason to stay engaged. This adds star + text reviews (from logged-in users on claimed listings), a moderation queue to keep them safe and on-policy, public display on Pages, and the review-count signal that feeds auto-certification. Done when reviews can be submitted, moderated, and displayed on a Page.

**Checklist.**
- ✅ Star + text review submission (logged-in) — live (intake→published); **+ B2a multi-criteria ratings + B2b moderated photos** built
- ✅ Moderation queue (approve / reject / remove) — `/admin/reviews` + `moderateReview`; **photo approval rides review publish**
- ✅ Public display on Pages with average rating — live; **+ per-criterion breakdown chips + category-average strip + photo thumbnails**
- Review-count feeds the certification signal — _still open (the certification wiring is the remaining V1 piece)_

**Note (2026-06-22):** base reviews were already live; Pillar B's B2a + B2b extended them with multi-criteria ratings and moderated photos. What remains on this card is the **auto-certification signal wiring** (review-count/tenure → Certified tier), not the review UX itself.

---

**`[V1] 🟠 P1` Trust tiers workflow**
🟦 Frontend · 🟩 Backend · **Due ~Aug 29, 2026**

**Description.** Codifies how a listing earns credibility — Claimed (owner verified email) → Verified (documents reviewed) → Certified (verified + sustained activity) — with an admin verification queue and visible badges. This is what lets users tell a self-serve listing apart from a vetted one, and it's the backbone of the platform's trust promise. Done when all three tiers and the verification queue work end-to-end.

**Checklist.**
- Claimed → Verified (document review) → Certified transitions
- Admin verification queue (review docs, approve/deny)
- Tier badges on Pages + cards
- Auto-certification rule wired to reviews + tenure

---

**`[V1] 🟡 P2` Additional Page templates** — _Event template ⏩ **pulled forward** by Pillar B B6 (2026-06-22)_
🟦 Frontend · **Due ~Sep 5, 2026**

**Description.** MVP ships only the Business template; V1 adds the other entity types the data model already anticipates — Professional, Creative, Event (with auto-expiry), and Job — so the platform fits more of the community than just brick-and-mortar businesses. Done when each template renders correctly and is used by at least one real listing.

**Checklist.**
- Professional template
- Creative template
- ✅ **Event template — DONE (Pillar B B6):** `event` entity type + `listing_details_event` table, `/add-event` create flow, event page (When/Where + ticket CTA + organizer + Event JSON-LD), dashboard editor, Events discovery filter, organizer "Upcoming events". _Auto-expiry not built — events are time-filtered (`starts_at >= now`) in the organizer list; a hard auto-archive job is deferred._
- Job template
- Each used by ≥1 real listing

**Note (2026-06-22):** the Event template is now a fully shipped first-class entity (the heaviest of the four). Remaining on this card: Professional, Creative, and Job templates, plus an optional event auto-expiry/archive job.

---

**`[V1] 🟡 P2` Supporter dashboard**
🟦 Frontend · **Due ~Sep 12, 2026**

**Description.** Gives the non-owner audience — the shoppers — their own home: saved lists, recently viewed, and suggested businesses, turning one-time visitors into return users. It's the supporter-side complement to the owner dashboard. Done when a supporter can manage saved lists and see relevant recommendations.

**Checklist.**
- Saved lists (create / rename / organize)
- Recently viewed
- Suggested businesses

---

**`[V1] 🔴 P0` Stripe subscriptions (Free / Standard / Premium)**
🟩 Backend · 🩷 Product · **Due ~Sep 12, 2026** · ⏳ Waiting-external (Stripe)

**Description.** Switches on the first revenue with three listing tiers and real billing — checkout, a billing portal, plan-based feature gating, and webhooks — replacing the placeholder Stripe price IDs. It's the P0 of V1 because monetization is the phase's reason for being, and it carries a Stripe account-approval/verification lead time. Done when a business can upgrade, the payment processes, and the plan's entitlements are enforced.

**Checklist.**
- Stripe account approved + real price IDs
- Checkout + billing portal
- Plan-based feature gating
- Webhooks (subscription lifecycle) verified

---

**`[V1] 🟠 P1` Sponsored placements**
🟩 Backend · 🟦 Frontend · **Due ~Sep 12, 2026**

**Description.** Lets premium listings pay for top-of-search and category visibility — the second revenue lever after subscriptions — with admin controls and expiry. It must be visually honest (clearly marked) to protect trust. Done when sponsored slots render with the correct placement rules and at least a few are live.

**Checklist.**
- Premium top-of-search + category placement
- Placement rules + clear "Sponsored" labeling
- Admin controls + expiry

---

**`[V1] 🟡 P2` Editorial CMS expansion**
🟧 Content/Data · 🟦 Frontend · **Due ~Sep 12, 2026**

**Description.** Builds out the editorial surfaces beyond Collections (already hero-grade) — BLACQLight articles, Guides, and a homepage editorial carousel — so the platform feels alive and curated rather than a raw database. Editorial is a key retention and SEO surface. Done when articles and guides can be authored and published and the homepage features them.

**Checklist.**
- BLACQLight articles (author + publish)
- Guides (sectioned, city-scoped)
- Homepage editorial carousel

---

**`[V1] 🟠 P1` City expansion #1 (2–4 new cities)**
🟧 Content/Data · **Due ~Sep 12, 2026**

**Description.** Extends beyond the three launch cities to 2–4 more (lighter coverage than Atlanta), and — more importantly — establishes the repeatable city-onboarding playbook (source → seed → activate) that V4's scale phase will lean on. Done when the new cities have working city pages and minimum seed data.

**Checklist.**
- City-onboarding playbook documented
- Seed data per new city (lighter threshold)
- Activate city pages + categories

---

### 🗂️ V2 — Commerce Layer (due ≤ Dec 5, 2026)

---

**`[V2] 🔴 P0` Marketplace: vendor storefronts + product/service listings**
🟦 Frontend · 🟩 Backend · **Due ~Oct 2026**

**Description.** The foundation of the commerce layer — Black-owned vendors get storefront Pages and can list products and services, turning the directory from "find a business" into "shop the business." Done when a vendor can create a storefront and publish product/service listings.

**Checklist.**
- Vendor storefront Pages
- Product listings (price, inventory, media)
- Service listings
- Vendor onboarding flow

---

**`[V2] 🔴 P0` Cart + checkout (Stripe) + order management**
🟩 Backend · 🩷 Product · **Due ~Nov 2026** · ⏳ Waiting-external (payments/compliance)

**Description.** Makes the marketplace transactional — a customer can add items to a cart, check out via Stripe, and the vendor can manage the resulting orders. This is the P0 of V2 and carries the heaviest compliance surface in the whole roadmap (refunds, disputes, tax, payouts). Done when a purchase completes end-to-end and vendors can manage orders.

**Checklist.**
- Cart
- Stripe checkout (incl. refunds/disputes handling)
- Order management (vendor + buyer views)
- Tax + payout model reviewed

---

**`[V2] 🟠 P1` Receipt upload + OCR + categorization**
🟩 Backend · 🟩 Lime (AI) · **Due ~Nov 2026**

**Description.** Lets users photograph receipts and have them automatically read and categorized into spend data — the input that powers the spend dashboards and, later, BLACQ Web's flow map. Done when a receipt becomes a categorized spend event with acceptable accuracy.

**Checklist.**
- Receipt photo capture + upload
- OCR extraction
- Auto-categorization → spend event
- Manual correction path

---

**`[V2] 🟠 P1` Personal spend dashboard + community spend aggregate**
🟦 Frontend · 🟩 Backend · **Due ~Dec 2026**

**Description.** Turns receipt/order data into insight — a personal "here's what I spent with Black-owned businesses" view and an anonymized community aggregate that tells the collective story. The community aggregate is the data spine of BLACQ Web. Done when both render real, correctly-aggregated data.

**Checklist.**
- Personal spend dashboard (by category, by month)
- Community aggregate (anonymized, by city/category)
- Privacy review of aggregation

---

**`[V2] 🟠 P1` AI beta**
🟩 Lime (AI) · **Due ~Dec 2026**

**Description.** Introduces the first AI agents in a contained beta — page-optimization suggestions for owners and conversational discovery for shoppers — validating the AI cost/quality model before V3's full concierge. Done when both features work in beta behind a flag with an acceptable cost ceiling.

**Checklist.**
- Page-optimization suggestions (owner-facing)
- Conversational discovery (shopper-facing)
- Cost/quality model validated; behind a flag

---

**`[V2] 🟡 P2` Job / event monetization**
🟩 Backend · **Due ~Dec 2026**

**Description.** Adds paid posting and promotion for jobs and events, extending revenue beyond subscriptions and sponsorship into the engagement surfaces. Done when a paid posting/promotion flow works end-to-end.

**Checklist.**
- Paid job posting
- Paid event promotion
- Billing wired to Stripe

---

### 🗂️ V3 — Intelligence Layer · BLACQ Web + "Future of Black Commerce" (due ≤ Mar 13, 2027)

---

**`[V3] 🔴 P0` BLACQ Web — 3D commerce-flow map**
🟦 Sky (3D) · 🟪 Design · **Due ~Mar 2027** · _own sub-board_

**Description.** The signature experience — a 3D interactive map of how dollars circulate through the Black community, built on the brand's gold node-network (React-Three-Fiber / Three.js, evolved from `bl-flow.js`). Because it's a substantial WebGL build with real performance and accessibility stakes, it gets its own sub-board and follows the 3D rules: justify the medium, model the flow data, build ambient + explorable modes within a strict performance budget, and ship a full accessible fallback. It can only be meaningful once V2 produces real spend data to visualize, and it must never put spectacle ahead of usability. Done when it renders real spend-flow data, performs within budget on mobile, and has an accessible equivalent.

**Checklist.**
- Medium decision (WebGL justified vs CSS/SVG/Canvas) + one-sentence scene purpose + aesthetic references
- Flow data model (community spend → nodes / edges / flow markers) + API
- Ambient mode (calm auto-rotate behind hero) + explorable mode (drag/zoom)
- Performance budget — mobile GPU tier, lazy-load, render-on-demand, capped pixel ratio, no LCP/INP regression
- Accessibility fallback — accessible data table, reduced-motion variant, keyboard controls, non-canvas text
- Static SVG/image fallback when WebGL unsupported/fails
- QA on a real low-end device; asset inventory + licensing

---

**`[V3] 🔴 P0` AI concierge (full agents)**
🟩 Lime (AI) · **Due ~Mar 2027**

**Description.** Graduates the V2 AI beta into three production agents — a shopper discovery concierge, a business-optimization assistant, and an admin curator — making the platform genuinely intelligent rather than just searchable. Done when each agent reliably handles its core task within cost.

**Checklist.**
- Shopper discovery agent
- Business optimization agent
- Admin curator agent
- Guardrails + cost monitoring

---

**`[V3] 🟠 P1` Sponsor campaigns (self-serve)**
🟩 Backend · 🩷 Product · **Due ~Mar 2027**

**Description.** A self-serve campaign builder for sponsors — placement + analytics — deepening sponsorship revenue beyond V1's manual placements into a scalable, measurable product. Done when a sponsor can create, run, and measure a campaign without manual setup.

**Checklist.**
- Campaign builder (audience, placement, budget)
- Placement engine
- Campaign analytics

---

**`[V3] 🟠 P1` Community impact analytics**
🟦 Frontend · 🟩 Backend · **Due ~Mar 2027**

**Description.** A public-facing impact page and downloadable reports that quantify the platform's effect on Black commerce — the story that drives press, partnerships, and community pride. Done when the impact page is live with real, defensible numbers.

**Checklist.**
- Public impact page (key metrics)
- Downloadable reports
- Data sourcing + methodology documented

---

**`[V3] 🟡 P2` "Future of Black Commerce" experience pass**
🟪 Design · 🟦 Sky (3D) · **Due ~Mar 2027**

**Description.** A design-led polish pass — motion, interactivity, and brand-forward storytelling surfaces — that makes the whole product *feel* like the future it promises, tying the BLACQ Web aesthetic through the rest of the experience. Done when the key surfaces meet the elevated experience bar without regressing performance or accessibility.

**Checklist.**
- Motion system + microinteractions (reduced-motion safe)
- Brand-forward storytelling surfaces
- Perf + a11y guardrails hold

---

### 🗂️ V4 — Scale (rolling · mid-2027)

---

**`[V4] 🔴 P0` Mobile app (React Native / Expo)**
🟦 Frontend · ⬛ Infra · **Due ~Q2 2027** · ⏳ Waiting-external (app-store review)

**Description.** Native iOS/Android via React Native + Expo on the **same Supabase backend** (never a second backend), gated first by a platform decision (web/PWA rejected with concrete reasons). It carries app-store review and developer-account lead times that no amount of build speed can compress. Done when the app is live on both stores via a phased rollout.

**Checklist.**
- Platform decision gate (responsive web → PWA → RN/Expo → native)
- Shared Supabase backend + push notifications
- Store compliance (privacy labels, in-app account deletion, IAP rules)
- Phased rollout + crash monitoring

---

**`[V4] 🟠 P1` City scale to 25+ + Spanish (i18n)**
🟧 Content/Data · 🟦 Frontend · **Due ~mid-2027**

**Description.** Scales the city-onboarding playbook from V1 to 25+ markets and adds Spanish localization to widen reach into more of the community. Done when 25+ cities are active and the UI is fully translated.

**Checklist.**
- City pipeline to 25+ markets
- Spanish (i18n) across the UI
- Per-city content QA

---

**`[V4] 🟡 P2` Platform hardening**
⬛ Infra · 🟩 Backend · **Due ~mid-2027**

**Description.** The security-and-scale maturity pass deferred from MVP — Content Security Policy, CAPTCHA, upload virus scanning, a formal penetration test, a partner API, and advanced moderation — bringing the platform to enterprise/partner readiness. Done when the hardening checklist is complete and the pen test passes.

**Checklist.**
- CSP + security headers
- CAPTCHA on sign-up / claims / reviews
- Upload virus scanning
- Penetration test passed
- Partner API + advanced moderation

---

## 5) How to use this board

1. **In Trello:** create the 8 lists (section 2), add the 10 color **Area** labels (section 1), then create cards using the title prefixes + due dates, pasting the **Description** into the card body and the **Checklist** as a Trello checklist. Filter by phase prefix (`[MVP]`, `[V1]`…) to focus one milestone at a time.
2. **Start now:** Wave A is underway — the a11y quick fixes are ✅ done (BRM-01/02) and the founder data-review sheet is generated (`docs/blacqlist/data/seed-review.csv`). What's left in Wave A is report-writing on the already-green audits and the ⏳ external/founder items — **legal copy review, founder data review, DNS, domain** — which now set the floor. Move those first.
3. **Re-baseline** the V1–V4 dates after MVP launch — real velocity from the launch sprint sharpens the later estimates.
4. **Decompose** each V1–V4 epic into granular cards at that phase's kickoff (especially **BLACQ Web**, which warrants its own sub-board with the 3D planning/performance/accessibility rules).

## 6) Source of truth

Built from: `docs/blacqlist/launch/` (production-readiness-plan, remaining-tests-runbook, supabase-production-checklist, production-deployment-runbook, environment-variable-checklist, on-call, rollback/incident runbooks), `docs/blacqlist/qa/` (mvp-release-readiness-checklist, mvp-bug-risk-log, cross-browser-and-launch-gates-guide, manual-qa-runbook), `docs/blacqlist/tickets/` (086–098 audits, 091–095 production), `e2e/launch-gates.spec.ts`, and `docs/blacqlist/product/release-roadmap.md`.

---

## 7) Phase cover cards

Paste each block as the **first card in its phase / pinned cover card** (or onto a phase label card). They tell anyone on the board — at a glance — what the phase is for, when it's due, and how we know it's finished.

> **Optional phase labels:** if you'd rather track phase with Trello labels than title prefixes, add a second label set reusing colors: `MVP` = green · `V1` = yellow · `V2` = orange · `V3` = purple · `V4` = sky. (Area labels stay as the primary color system; a card can hold both.)

---

### 🚀 [MVP] Public Launch — "Find & Be Found"
**Phase color:** Green · **Window:** Jun 20 – Jul 11, 2026 · **Lead:** Founder + Claude

**Goal.** Get a working, trustworthy directory live in Atlanta, Houston, and Chicago so real people can discover, save, claim, and list Black-owned businesses — and we can start serving customers.

**What ships.** Public discovery (home, search, city/category, BLACQList Pages) · claim + add-business · owner dashboard · admin moderation · editorial Collections · transactional email — on a production domain with backups + monitoring.

**Definition of Done (all true).**
- All launch gates pass **in production** (M1–M10)
- Security + accessibility + performance + SEO audits passed; **zero open P0 bugs**
- 150 ATL / 50 HOU / 50 CHI published listings, **founder-reviewed**, ≥40% with images
- Privacy & Terms reviewed (no placeholder copy)
- Soft launch clean; Tech + Product + Legal **go/no-go signed**
- Live on `theblacqlist.com` with PITR, Sentry, uptime monitors, on-call rotation

**Entry criteria.** None — this is the active phase (started today).
**External dependencies ⏳.** Legal review (3–5d) · Resend DNS (2–48h) · domain registration · founder data review.
**Top risks.** Legal copy turnaround; production data quality/consent; audit findings forcing rework.
**Success signal.** A non-team member completes *search → view Page → save → claim* unaided; first real businesses live; errors monitored.

---

### 🤝 [V1] Trust & Grow
**Phase color:** Yellow · **Window:** ~Jul 14 – Sep 12, 2026 · **Lead:** Founder + Claude

**Goal.** Turn a discoverable directory into a *trusted* one — give owners reasons to stay active and switch on the first revenue.

**What ships.** Reviews + moderation · trust tiers (Claimed → Verified → Certified) · Professional/Creative/Event/Job Page templates · supporter dashboard · Stripe subscriptions (Free/Standard/Premium) · sponsored placements · editorial expansion (BLACQLight + Guides) · 2–4 new cities.

**Definition of Done.** Reviews live, moderated, and displaying on Pages · all 3 trust tiers working · **≥1 paying business** on a tier · sponsored placements live · each non-business template used by a real listing · new cities have city pages + minimum seed.

**Entry criteria.** MVP launched and stable (no open P0s for 1 week) · Stripe account approved.
**External dependencies ⏳.** Stripe account + verification · real business data for new cities.
**Top risks.** Payment compliance; moderation load from reviews.
**Success signal.** First paid upgrade; reviews on Pages; a non-Atlanta business gets claimed.

---

### 🛒 [V2] Commerce Layer
**Phase color:** Orange · **Window:** ~Sep 15 – Dec 5, 2026 · **Lead:** Founder + Claude

**Goal.** Make BLACQList *transactional* — people can buy from Black-owned vendors and see their spend.

**What ships.** Marketplace (vendor storefronts, product/service listings) · cart + checkout (Stripe) + order management · receipt upload + OCR + categorization · personal + community spend dashboards · AI beta (page-optimization + conversational discovery) · paid job/event posting.

**Definition of Done.** A customer completes a purchase end-to-end · vendors manage orders · receipt → categorized spend works · community spend aggregate shows real data · AI suggestions usable in beta.

**Entry criteria.** V1 monetization live and stable · payments + tax/compliance reviewed.
**External dependencies ⏳.** Payment processing + tax/compliance · OCR provider · AI provider (Anthropic) keys + cost model.
**Top risks.** Checkout/refund/dispute edge cases; OCR accuracy; AI cost.
**Success signal.** First marketplace order processed; first dollars of tracked community spend.

---

### 🧠 [V3] Intelligence Layer — BLACQ Web + "Future of Black Commerce"
**Phase color:** Purple · **Window:** ~Dec 8, 2026 – Mar 13, 2027 · **Lead:** Founder + Claude

**Goal.** Make the *circulation of the Black dollar* visible and intelligent — the signature, brand-defining experience.

**What ships.** **BLACQ Web** — the 3D interactive commerce-flow map (gold node network; R3F/Three.js, evolved from `bl-flow.js`) · full AI concierge/agents (shopper discovery, business optimization, admin curator) · self-serve sponsor campaigns · public community impact analytics · experience/interactivity polish.

**Definition of Done.** BLACQ Web renders real spend-flow data, performs within budget on mobile, and ships a **full accessible fallback** (data table + reduced-motion + keyboard) · AI agents handle their core tasks · impact page is public.

**Entry criteria.** V2 commerce/spend data flowing (there's real data to visualize) · performance + accessibility budgets agreed.
**External dependencies ⏳.** Enough real transaction/spend data for the map to be meaningful · 3D asset/licensing · AI cost ceiling.
**Top risks.** BLACQ Web is a substantial WebGL build — **give it its own sub-board** (medium decision → flow data model → ambient/explorable modes → perf budget → accessibility fallback → low-end device QA). Don't let spectacle outrun usability.
**Success signal.** A visitor explores the live dollar-flow map and can read the same data as an accessible table.

---

### 📱 [V4] Scale
**Phase color:** Sky · **Window:** ~Q2 2027 → rolling · **Lead:** Founder + Claude

**Goal.** Take it everywhere — mobile, more cities, more languages, partner-ready.

**What ships.** Mobile app (React Native/Expo, **shared Supabase backend** — never a second backend) · 25+ cities · Spanish (i18n) · platform hardening (CSP, CAPTCHA, upload virus scanning, penetration test, partner API, advanced moderation).

**Definition of Done.** App live on App Store + Play (phased rollout) · 25+ active cities · Spanish UI · security hardening complete · partner API documented.

**Entry criteria.** V3 features stable · platform decision gate passed for mobile (web/PWA rejected with reasons first).
**External dependencies ⏳.** Apple/Google developer accounts + store review · multi-city data pipeline · translation.
**Top risks.** App-store review lead time + policy compliance; data quality at city scale.
**Success signal.** First app-store install; first non-English journey; first partner integration.

---

## 8) Label legend card

Paste this as a pinned card (top of **🗂️ Backlog** or **📍 Milestones**) so the board is self-documenting.

**🏷️ How this board is labeled**

**Color = Area** (the primary filter):
🟥 Compliance/Legal/Privacy · 🟧 Content/Data · 🟨 QA/Testing · 🟩 Backend/API/DB · 🟦 Frontend/UX · 🟪 Design/Brand · ⬛ Infra/DevOps · 🟦 Sky = 3D/Interactive (BLACQ Web) · 🟩 Lime = AI/Agents · 🩷 Pink = Product/PM

**Priority** (title prefix): `🔴 P0` launch blocker · `🟠 P1` important · `🟡 P2` should-have · `⚪ P3` nice-to-have

**Phase** (title prefix or phase label): `[MVP]` · `[V1]` · `[V2]` · `[V3]` · `[V4]`

**Status markers** (add to title when true): `⛔ Blocked` · `⏳ Waiting-external` (DNS, legal, Stripe, app-store)

**Reading a card title:** `[MVP] 🔴 P0 Supabase production project (091)` → MVP phase, launch blocker, Infra (black label). Move ⏳ external-dependency cards first — they set the timeline floor.
