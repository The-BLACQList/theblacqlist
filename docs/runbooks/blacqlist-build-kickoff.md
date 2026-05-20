# BLACQList Build Kickoff

**Project:** The BLACQList
**Kickoff date:** 2026-05-07
**Project root:** `software-agent-bundle/projects/theblacqlist/`
**Status:** Pre-planning — no code exists yet

---

## Workspace Type

**Agent-bundle-only repo. Clean starting point.**

The workspace at `software-agent-bundle/` is a pure chat-first markdown agent system with no framework code. There is no `package.json`, no `next.config.js`, no `wp-config.php`, no `src/`, `app/`, or `pages/` directories, and no database migrations anywhere in the bundle.

The BLACQList project is brand-new. This `projects/theblacqlist/` folder is the first artifact written for it.

---

## Existing Files Found

### Agent Bundle (do not modify)

```
software-agent-bundle/
├── CLAUDE.md                        ← bundle operating rules
├── agents/                          ← 8 agent role CLAUDE.md files
│   ├── app/, backend/, docs/, frontend/
│   ├── product/, qa/, release/, website/
├── workflows/                       ← 5 workflow orchestration files
│   ├── new-product.md, new-feature.md
│   ├── bug-to-fix.md, docs-sprint.md, release-prep.md
├── templates/                       ← 14 reusable document templates
├── .claude/
│   ├── agents/                      ← 16 specialized sub-agents
│   ├── rules/                       ← 11 domain rule sets
│   ├── skills/                      ← 12 reusable skills
│   └── templates/                   ← 17 additional templates
└── docs/                            ← bundle docs + test artifacts (not BLACQList)
    ├── product/product-brief.md     ← TEST ARTIFACT — not BLACQList
    ├── architecture/                ← TEST ARTIFACTS — not BLACQList
    ├── runbooks/                    ← agent bundle operational runbooks
    └── ...
```

> **Important:** The `docs/` folder in the bundle root contains test artifacts generated during agent system validation. These are NOT BLACQList planning documents. Do not confuse them with project artifacts. All BLACQList artifacts live exclusively under `projects/theblacqlist/`.

### Siblings in `/Desktop/agents/` (unrelated)

```
athlete-os-agent/
brand-interface-studio/
codio-curriculum-dev-agent/
house_manager_agent/
pd-exec-ops-bundle/
pd-session-agent-2/
software-agent-bundle/     ← active workspace
```

None of these contain BLACQList code or content.

---

## Agent Bundle Status

**Fully operational. Ready to use immediately.**

| Component                              | Count | Status |
| -------------------------------------- | ----- | ------ |
| Specialized agents (`.claude/agents/`) | 16    | Active |
| Domain rule sets (`.claude/rules/`)    | 11    | Active |
| Reusable skills (`.claude/skills/`)    | 12    | Active |
| Workflow definitions (`workflows/`)    | 5     | Active |
| Document templates (combined)          | 31    | Active |
| Agent role CLAUDE.md files (`agents/`) | 8     | Active |

**Relevant agents for this project:**

| Agent                   | Use                                              |
| ----------------------- | ------------------------------------------------ |
| `product-strategist`    | Product brief, user types, problem statements    |
| `mvp-scope-agent`       | MVP scoping, must-have vs. later                 |
| `ux-flow-agent`         | User flows, screen maps, onboarding, states      |
| `schema-data-agent`     | Data model, entities, relationships, migrations  |
| `backend-architect`     | Auth, permissions, API design, storage, security |
| `frontend-architect`    | Routes, components, layouts, state, forms        |
| `api-integration-agent` | API contracts, route handlers, validation        |
| `dev-ticket-writer`     | Dev tickets from approved specs                  |
| `qa-test-agent`         | QA plans, test cases, launch readiness           |
| `docs-agent`            | User guides, admin docs, release notes           |
| `ui-visual-designer`    | Design direction, Tailwind/shadcn visual system  |
| `website-strategist`    | Marketing site, landing pages, SEO               |

---

## Recommended Build Path

**Follow this order exactly. Do not skip phases.**

### Phase 0 — Foundation (now)

- [x] Create `projects/theblacqlist/` project root
- [x] Write this kickoff runbook
- [ ] Create `projects/theblacqlist/docs/` folder structure

### Phase 1 — Product Definition

- [ ] Product brief (`docs/product/product-brief.md`)
- [ ] MVP spec (`docs/product/mvp-spec.md`)

### Phase 2 — UX Planning

- [ ] User flows (`docs/ux/user-flows.md`)
- [ ] Site map (`docs/ux/site-map.md`)
- [ ] Screen map (`docs/ux/screen-map.md`)
- [ ] Empty / loading / error / success states (`docs/ux/states.md`)

### Phase 3 — Architecture

- [ ] Data model (`docs/architecture/data-model.md`)
- [ ] Auth and permissions (`docs/architecture/auth-permissions.md`)
- [ ] API contract (`docs/architecture/api-contract.md`)

### Phase 4 — Design Direction

- [ ] Visual design brief (`docs/design/website-design-brief.md`)

### Phase 5 — Dev Tickets

- [ ] Ticket README (`docs/tickets/README.md`)
- [ ] First 5–10 tickets covering MVP flows

### Phase 6 — Implementation (when tickets are approved)

- [ ] Next.js project scaffold
- [ ] Database + Supabase setup
- [ ] Core entity CRUD
- [ ] Discovery + search
- [ ] BLACQList Pages

### Phase 7 — QA + Release

- [ ] QA plan (`docs/qa/test-plan.md`)
- [ ] Launch checklist (`docs/qa/launch-checklist.md`)
- [ ] Release notes (`docs/handoff/release-notes.md`)

---

## Suggested Tech Stack

| Layer          | Choice                         | Notes                                              |
| -------------- | ------------------------------ | -------------------------------------------------- |
| Framework      | Next.js 14+ (App Router)       | Server Components + streaming                      |
| Language       | TypeScript                     | Strict mode                                        |
| Styling        | Tailwind CSS                   | Mobile-first                                       |
| Components     | shadcn/ui                      | Accessible, composable                             |
| Database       | Supabase + PostgreSQL          | RLS enforced                                       |
| Auth           | Supabase Auth                  | Email, OAuth, magic link                           |
| Storage        | Supabase Storage               | Media, logos, receipts                             |
| Search (MVP)   | Supabase full-text + `pg_trgm` | Keyword + geo filter                               |
| Search (scale) | Algolia or Typesense           | When listings exceed ~50k                          |
| Geo / Maps     | Mapbox or Google Maps API      | City-aware discovery                               |
| Payments       | Stripe                         | Marketplace fees, listing tiers, sponsor campaigns |
| Email          | Resend                         | Transactional + marketing                          |
| AI agents      | Anthropic Claude API           | Discovery, page optimization, curation             |
| Hosting        | Vercel                         | Edge network, preview deploys                      |
| Analytics      | PostHog or Mixpanel            | User behavior, funnel analysis                     |
| Error tracking | Sentry                         | Production error monitoring                        |

---

## Major Product Modules

| #   | Module                          | Description                                                                         |
| --- | ------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | National Discovery + Search     | Full-text, category-filtered, geo-aware search across all entity types              |
| 2   | City-Aware Discovery            | City landing pages, trending local entities, local curation                         |
| 3   | BLACQList Pages                 | Micro-website templates per entity type — not basic profiles                        |
| 4   | Entity Types                    | Businesses, professionals, creatives, events, jobs, vendors, products, services     |
| 5   | Claim / Create / Manage         | Owner-facing workflows to create, claim, and maintain a BLACQList Page              |
| 6   | Trust + Verification            | Badge tiers, document upload, manual review, expiry management                      |
| 7   | Community Corrections           | Crowdsourced edits, flag-and-review, dispute resolution                             |
| 8   | Reviews                         | Star ratings, text reviews, helpful votes, review moderation                        |
| 9   | Saves + Shares                  | Saved lists, share-to-social, collection building                                   |
| 10  | Marketplace Foundation          | Vendor storefronts, product listings, checkout, fulfillment tracking                |
| 11  | Receipt Upload + Spend Tracking | Photo receipt capture, spend categorization, personal spend history                 |
| 12  | Dollar-Flow Map                 | Visual network of community spend circulation                                       |
| 13  | Dashboards                      | Supporter, business owner, vendor, sponsor, admin views                             |
| 14  | Editorial System                | BLACQLight articles, curated collections, city guides                               |
| 15  | AI Agents                       | Shopper-side discovery, business page optimization, admin curation                  |
| 16  | Monetization                    | Listing tiers, sponsored pages, marketplace fees, job posts, event promo, campaigns |
| 17  | Analytics                       | Platform analytics, business analytics, community impact analytics                  |

---

## Build Risks

| Risk                   | Level  | Notes                                                                                       |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Scope complexity       | High   | 17 modules — MVP must be ruthlessly scoped to 2–3 modules max                               |
| Entity type diversity  | High   | 8 entity types require unique fields, flows, and page templates each                        |
| Trust + verification   | High   | Social, legal, and community design challenge — not just technical                          |
| Search at scale        | High   | Full-text + geo + category filtering is infrastructure-heavy                                |
| Marketplace legality   | High   | Vendor payouts, fees, disputes require legal + compliance review before shipping            |
| AI agent design        | Medium | Prompt engineering + guardrails required before any AI feature ships to users               |
| Dollar-flow map        | Medium | Graph/network visualization is a distinct engineering investment — defer to later           |
| Content cold-start     | High   | Platform has no value without listings — seeding and supply strategy is critical pre-launch |
| Community moderation   | Medium | Corrections, reviews, and flagging require human-in-the-loop workflows                      |
| Multi-role permissions | Medium | 5 roles (supporter, owner, vendor, sponsor, admin) have distinct access boundaries          |
| Marketplace cold-start | High   | Both supply (vendors) and demand (shoppers) must be seeded simultaneously                   |

---

## First 10 Artifacts to Create

Create these in order. Do not skip ahead.

| #   | Artifact              | Path                                       | Agent                   |
| --- | --------------------- | ------------------------------------------ | ----------------------- |
| 1   | Product brief         | `docs/product/product-brief.md`            | `product-strategist`    |
| 2   | MVP spec              | `docs/product/mvp-spec.md`                 | `mvp-scope-agent`       |
| 3   | User flows            | `docs/ux/user-flows.md`                    | `ux-flow-agent`         |
| 4   | Site map              | `docs/ux/site-map.md`                      | `ux-flow-agent`         |
| 5   | Screen map            | `docs/ux/screen-map.md`                    | `ux-flow-agent`         |
| 6   | Data model            | `docs/architecture/data-model.md`          | `schema-data-agent`     |
| 7   | Auth + permissions    | `docs/architecture/auth-permissions.md`    | `backend-architect`     |
| 8   | API contract          | `docs/architecture/api-contract.md`        | `api-integration-agent` |
| 9   | Design brief          | `docs/design/website-design-brief.md`      | `ui-visual-designer`    |
| 10  | Dev tickets (first 5) | `docs/tickets/001-*.md` through `005-*.md` | `dev-ticket-writer`     |

---

## Next Recommended Prompt

Copy and run this next:

```
Act as the Product agent — create the full product brief for The BLACQList.

Save it to: projects/theblacqlist/docs/product/product-brief.md

The BLACQList is a national Black discovery, marketplace, and community commerce platform.
Positioning: Atlanta-born. National from day one. Community-powered everywhere.
Tagline: Find & Be Found. Find what you need. Support who matters. Keep the dollar moving.

Include all of the following sections:
- Problem statement (who, what, why, consequence)
- Target users — at minimum: the searcher/supporter, the business owner, the marketplace vendor, the creative, the admin
- Core value proposition
- Core workflows (2–5, written as trigger → steps → end state)
- MVP vs. Later feature split
- Assumptions (list and flag high-risk ones)
- Risks (categorized: technical, product, business, data, legal)
- Success criteria (measurable)
- Open questions that must be answered before MVP scoping begins
```
