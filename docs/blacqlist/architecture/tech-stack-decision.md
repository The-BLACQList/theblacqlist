# Technology Stack Decision Record — The BLACQList

**Last updated:** 2026-05-07
**Status:** Decided
**Owner:** Architecture + Engineering
**Related:** `architecture-decisions.md`, `entity-content-model.md`, `release-roadmap.md`

---

## Why This Document Exists

The BLACQList is not a single-purpose application. It is a four-phase platform that begins as an SEO-critical discovery directory, becomes a community trust layer, evolves into a commerce marketplace, and ultimately incorporates AI-assisted discovery and dollar-flow visualization. Each phase imposes different optimization pressures on the stack: the discovery phase demands ISR and fast cold-read performance; the trust phase demands RLS correctness and audit integrity; the commerce phase demands payment reliability and atomic transaction guarantees; the AI phase demands server-side inference routing and cost controls.

Stack choices made for MVP must hold through all four phases without triggering a full rewrite. This document records what was chosen at each layer, why it was chosen specifically for this project's constraints, what was rejected and why, what risks are accepted, and the exact conditions under which any layer is expected to change. Engineers evaluating these decisions should read this document before raising architectural alternatives. Changes to any decided layer require updating this document first.

---

## Stack Summary

| Layer                    | Choice                                 | Phase introduced |
| ------------------------ | -------------------------------------- | ---------------- |
| Framework                | Next.js 14+ with App Router            | Phase 0          |
| Language                 | TypeScript (strict mode)               | Phase 0          |
| Styling                  | Tailwind CSS                           | Phase 0          |
| Components               | shadcn/ui                              | Phase 0          |
| Database                 | Supabase + PostgreSQL                  | Phase 0          |
| Database schema pattern  | Base + extension tables                | Phase 0          |
| Auth                     | Supabase Auth                          | Phase 0          |
| Storage                  | Supabase Storage                       | Phase 0          |
| Search (MVP)             | PostgreSQL FTS (tsvector + pg_trgm)    | Phase 1          |
| Email                    | Resend + React Email                   | Phase 1          |
| Error tracking           | Sentry                                 | Phase 0          |
| Analytics                | Vercel Analytics + custom events table | Phase 1          |
| Hosting                  | Vercel                                 | Phase 0          |
| Payments — subscriptions | Stripe (subscriptions)                 | V1               |
| Payments — marketplace   | Stripe Connect                         | V2               |
| Search (upgraded)        | Algolia                                | V2 (conditional) |
| AI                       | Anthropic Claude API                   | V2               |

---

## 1. Framework Layer — Next.js App Router

### Decision

Next.js 14+ with the App Router. No alternatives under active consideration.

### Alternatives evaluated

| Alternative      | Why rejected                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Remix            | Excellent data loading patterns (loaders/actions are well-designed), but ISR is not a first-class primitive. BLACQList Pages must be cacheable at the edge with periodic revalidation — Remix's model is closer to "SSR or nothing." Smaller ecosystem also means more unsupported third-party integrations.             |
| SvelteKit        | Strong performance profile and clean DX, but smaller talent pool and fewer established patterns for the enterprise-adjacent concerns on this platform (multi-role auth with middleware, Supabase RLS integration, complex SEO metadata APIs). Not the right fit for a team that needs to move fast on a proven scaffold. |
| Vite + React SPA | Excellent for apps where SEO is irrelevant. Rules out SSR entirely without a significant additional layer. Every BLACQList Page is a public-facing, Google-indexed entity page — SPA rendering is a non-starter.                                                                                                         |

### Why Next.js wins for this project

The BLACQList has three distinct rendering requirements that all exist simultaneously:

1. **Entity pages (BLACQList Pages)** — `/listing/[slug]` pages must be fully server-rendered and SEO-optimized, but do not need to be rebuilt on every request. ISR with `revalidate: 3600` means a page is rebuilt at most once per hour under load. At 5,000 listings, this means 5,000 static pages served from Vercel's edge CDN with zero Supabase query cost per page view for the majority of traffic. No other framework in the shortlist provides this with zero configuration.

2. **Discovery pages (city/category landing pages)** — `/[city]/[category]` pages share the same ISR requirement. There are potentially hundreds of these at scale. Statically generating them with ISR and revalidating when listings in that city/category are updated is directly supported by Next.js `revalidatePath()` and `revalidateTag()`.

3. **Dashboard and admin pages** — authenticated, real-time, highly interactive. Server Components handle the data fetch; Client Components handle the interactivity. The App Router's boundary model allows mixing within the same route segment without separate routing infrastructure.

The App Router's `generateMetadata()` API handles the OG/SEO layer for every BLACQList Page — dynamic meta title, meta description, og:image, JSON-LD structured data, canonical URL — all from a single server-side function per route. This is non-trivial to replicate cleanly in any of the alternatives.

### Known risks

App Router is relatively young. Some patterns — parallel routes, intercepting routes, advanced streaming — have rough edges in the current ecosystem. Mitigation: the platform uses only stable, well-documented patterns. Parallel routes and intercepting routes are not used at MVP. Complex streaming is limited to dashboard Suspense boundaries where the benefit is clear.

### Upgrade / replacement

No replacement planned. Next.js is co-developed with Vercel; its stability trajectory is aligned with the platform's hosting choice.

---

## 2. Language — TypeScript Strict Mode

### Decision

All files are TypeScript (`.ts`, `.tsx`). Strict mode enabled in `tsconfig.json`. `any` is not permitted without a documented comment explaining why. `@ts-ignore` is not a valid suppression strategy.

### Alternatives evaluated

JavaScript was not seriously considered. A platform with 8 entity types (each with a distinct field shape), 4 user roles, RLS policies, Stripe webhook payloads, and an AI inference layer is exactly the problem domain TypeScript was designed for. The cost of type system escape hatches compounds over phases — by V2 when Stripe Connect payloads and Claude API responses are flowing through the codebase, an untyped codebase would require constant defensive programming or runtime surprises.

### Why strict mode specifically

Standard TypeScript mode leaves too many escape hatches open. Strict mode enforces `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and `strictPropertyInitialization`. For this project, `strictNullChecks` is the most important: many fields on the entity content model are explicitly nullable with defined fallback behavior. Without strict null checks, the compiler cannot verify that nullable fields are handled before being dereferenced. The number of fields that are intentionally null in the content model (approximately 60+ nullable fields documented in `entity-content-model.md`) makes this a runtime correctness guarantee, not a style preference.

### Known risks

Slower initial development for engineers not fluent in TypeScript's strict mode type system. Mitigation: shared type definitions seeded from the content model are established in `types/` at Phase 0, reducing the per-component type authoring burden. The content model document is the source of truth — types are derived from it, not invented.

### Upgrade / replacement

No replacement planned.

---

## 3. Styling — Tailwind CSS

### Decision

Tailwind CSS for all styling. No CSS-in-JS. No CSS Modules for component-level styles.

### Alternatives evaluated

| Alternative                 | Why rejected                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS Modules                 | Viable, but verbose for a component-heavy product. Switching between `.tsx` and `.module.css` for every component adds friction without meaningful benefit. Tailwind's purging gives equivalent bundle size control.                                                                                             |
| styled-components / Emotion | Runtime CSS-in-JS conflicts with Server Components — styled-components cannot be used in Server Components without client boundary wrapping every styled element. This would force most of the component tree to be Client Components, eliminating the Server Component benefits chosen for the framework layer. |
| Vanilla Extract             | Zero-runtime CSS-in-JS with excellent TypeScript integration, but niche adoption means fewer patterns, examples, and shadcn/ui integration. Not worth the learning overhead for a small team on a deadline.                                                                                                      |

### Why Tailwind wins for this project

The platform's design system is expressed entirely in Tailwind utility classes. shadcn/ui — the component library choice — is Tailwind-native and expects Tailwind for overrides. Implementing a separate styling layer alongside shadcn/ui creates a dual-system problem: some styles come from Tailwind, others from the alternative system, and the interaction between them becomes unpredictable.

Tailwind's purging removes all unused utility classes from the production build. A discovery platform with hundreds of pages and a consistent design system benefits from this — the CSS bundle stays small regardless of how many components reference utility classes during development.

The `cn()` utility (from `lib/utils`) handles conditional class merging. Complex class strings are extracted into named component variants, not left as inline strings in JSX.

### Known risks

Long `className` strings reduce readability in complex components. Mitigation: component extraction for repeated patterns, `cva` (class-variance-authority) for component variant management. This is a code organization discipline issue, not a performance or correctness risk.

### Upgrade / replacement

No replacement planned.

---

## 4. Components — shadcn/ui

### Decision

shadcn/ui as the base component library for all common UI patterns. Components are copied into the codebase and owned, not imported from a package.

### Alternatives evaluated

| Alternative                 | Why rejected                                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radix UI directly           | shadcn/ui is built on Radix primitives. Using Radix directly means building the styled layer from scratch — high build cost for buttons, dialogs, dropdowns, selects, forms. shadcn/ui gives the Radix accessibility guarantees with pre-built styling. |
| MUI / Ant Design            | Opinionated visual systems that conflict with The BLACQList brand. Customizing MUI to match a custom brand requires deeper overrides than starting from shadcn/ui. Bundle size is also significantly larger.                                            |
| Headless UI (Tailwind Labs) | Limited component count. No form components, no date pickers, limited table utilities. Would require supplementing with additional libraries for basic patterns.                                                                                        |
| Chakra UI                   | Strong DX and accessibility, but uses CSS-in-JS (Emotion) internally — same Server Component incompatibility issue as styled-components.                                                                                                                |

### Why shadcn/ui wins for this project

The copy-paste model is a structural advantage for a platform that will deviate from default component styling significantly. The BLACQList brand uses a specific color palette (documented in the brand guide) that requires overriding default shadcn/ui colors. When components live in the codebase rather than in a node_modules package, those overrides are permanent and cannot be regressed by an upstream package update.

Radix primitives underneath shadcn/ui provide dialog focus trapping, menu keyboard navigation, and ARIA patterns without custom implementation. These are non-trivial to build correctly and have been validated across hundreds of production applications.

The `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, and `FormMessage` components provide the complete accessible form pattern that every create/edit form on the platform uses. This is the most-used pattern on the owner dashboard and admin panel — a pre-built, accessible, hook-form-integrated implementation saves significant development time.

### Known risks

Manual updates when shadcn/ui releases changes — there is no `npm update` for owned components. Mitigation: this tradeoff is explicit and accepted. Components are reviewed for shadcn/ui breaking changes at each phase start. The stability of owned code is worth the update burden.

### Upgrade / replacement

No replacement planned.

---

## 5. Database — Supabase + PostgreSQL

### Decision

Supabase as the managed PostgreSQL platform. All data stored in PostgreSQL. Row Level Security enforced on every table. Supabase Auth and Supabase Storage co-located in the same project for integrated access control.

### Alternatives evaluated

| Alternative                | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firebase Firestore         | NoSQL document model is a poor fit for the entity content model. The platform has 8 entity types, each with a distinct extension table, plus junction tables for saves, claims, reviews, and subcategories. Relational queries (all businesses in city X with category Y sorted by trust tier) require SQL — Firestore's query model cannot express these without denormalization that creates significant consistency burdens. No SQL analytics layer. |
| PlanetScale (MySQL)        | Excellent serverless MySQL, but: (1) MySQL full-text search is weaker than PostgreSQL `tsvector` + `pg_trgm` for the MVP search tier; (2) no PostGIS support for V2 geo features; (3) no integrated Auth or Storage — adds two separate services to the stack; (4) branching model is useful for schema iteration but adds operational overhead for a small team.                                                                                       |
| Neon (serverless Postgres) | Strong technical choice — branching is excellent for schema migrations. But Neon is Postgres-only: it provides no Auth, no Storage, no RLS managed UI, no Realtime. Adopting Neon means building or integrating auth (Auth.js or Clerk), storage (S3 or Cloudflare R2), and a permission layer separately. Total integration surface is significantly larger.                                                                                           |
| PocketBase                 | Interesting self-hosted option but not managed — adds infrastructure responsibility for a small team. Not appropriate for a platform expecting 50K listings and 1M monthly requests at maturity.                                                                                                                                                                                                                                                        |

### Why Supabase wins for this project

The BLACQList MVP has five infrastructure requirements: database, auth, storage, RLS, and realtime capability (for future admin queue notifications). Supabase delivers all five from a single platform with a single billing relationship.

**RLS is the critical differentiator.** The platform has four user roles (visitor, supporter, business owner, admin) and two dozen tables with different access rules per role. Enforcing these at the application layer is error-prone — a missed check in one API route exposes data. RLS policies run at the database level and cannot be bypassed by application code. Supabase is the only managed option in the shortlist that provides RLS with a first-class management experience. The content model's trust tier, ownership, and verification workflows all depend on RLS correctness to prevent owners from editing other owners' listings or exposing verification documents.

**PostgreSQL FTS keeps MVP search cost at zero.** The search upgrade to Algolia is planned for V2, but it is optional — it triggers on performance or quality signals, not on a fixed date. Starting with FTS means the team does not manage an Algolia index synchronization pipeline before the listing volume justifies it.

**Supabase Storage's bucket policy model integrates with Supabase Auth.** The `verification-docs` private bucket uses RLS policies tied to `auth.uid()` to ensure only admins can generate signed URLs. This would require a separate signed URL service in any non-Supabase storage integration.

### Known risks

**Vendor lock-in** is the primary risk. Supabase's RLS policies, storage bucket policies, and `auth.uid()` in queries create deep platform coupling. Mitigation: all database queries are encapsulated in `lib/services/` modules that call standard PostgreSQL SQL — not Supabase-specific client methods wherever possible. A migration to raw Postgres on Railway or Neon is feasible but expensive. This risk is accepted because the integration benefit at MVP outweighs the future migration cost.

**Supabase pricing at scale** — the free tier is insufficient for production; the Pro plan ($25/mo) covers MVP and V1; beyond that, database egress and storage bandwidth costs scale with traffic. Monitoring begins at V1.

### Upgrade / replacement

No planned replacement. Database egress cost monitoring begins at V1; if costs exceed projections, evaluate self-hosting Postgres on Railway with a custom Auth/Storage layer. Timeline: assess at 100K monthly active users.

---

## 6. Database Schema Pattern — Base + Extension Tables

### Decision

All entity types share a single `listings` base table. Entity-type-specific fields live in separate `listing_details_*` extension tables with a one-to-one FK to `listings.id`. This is formally recorded in ADR-012.

### Alternatives evaluated

| Alternative                                        | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single table with all columns nullable             | Produces a 200+ column table at full entity-type coverage. Query performance degrades on tables with this many columns, even with selective indexing. Schema clarity is destroyed — it becomes impossible to tell which fields apply to which entity type without documentation. Any migration to add a field to one entity type requires `ALTER TABLE` on the main table, which locks the table in PostgreSQL. |
| EAV (Entity-Attribute-Value)                       | Maximum flexibility for arbitrary field addition, but catastrophic query performance. A query for "all businesses in Atlanta with hours set, a CTA, and a cover image" requires joining the EAV table multiple times with string attribute names. No type safety. No foreign key enforcement on values. Not viable for a platform that indexes and searches on structured fields.                               |
| JSONB supplement column                            | A `jsonb` column appended to a smaller base table. Better than EAV but still unindexable for filtered queries. The platform's search and filter needs (filter by `price_range`, `location_type`, `cta_type`, `trust_tier`) require indexed structured columns, not JSONB extraction.                                                                                                                            |
| Separate table per entity type with no shared base | Eliminates the shared base concept. Discovery, search, SEO, trust, admin, and status fields would be duplicated across 8 tables. Any cross-entity-type query (search results across all types, admin listing queue) requires a UNION or a more complex query. Any change to a shared field (adding `is_sponsored`) requires 8 migrations.                                                                       |

### Why base + extension wins for this project

The platform's search, discovery, SEO, trust, and admin workflows operate on fields that apply identically to every entity type. A unified `listings` base table means:

- A single `tsvector` column covers all entity types for full-text search.
- The admin claims queue is a single query against `listings.status = 'pending'`.
- RLS policies on `listings` apply to all entity types without duplication.
- Adding a new entity type (e.g., `listing_details_nonprofit` in V3) is additive — a new extension table, no schema changes to the base.

The join cost for fetching a full entity is one predictable JOIN per page render. Database views per entity type (`view_business_full`, `view_event_full`) pre-join base and extension for the rendering layer, making the query pattern clean.

### Known risks

Join complexity for multi-entity queries. Mitigation: indexed FKs on extension tables + database views per entity type.

### Upgrade / replacement

No replacement planned. The schema pattern is correct for the data model.

---

## 7. Auth — Supabase Auth

### Decision

Supabase Auth for all authentication flows. JWT sessions in httpOnly cookies via `@supabase/ssr`. Roles stored in a `user_roles` table, not in the JWT.

### Alternatives evaluated

| Alternative        | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clerk              | Excellent DX, pre-built UI components (sign-in/sign-up forms), strong user management dashboard. Rejected because: (1) Clerk's session tokens require a custom adapter to integrate with Supabase RLS — RLS policies use `auth.uid()` which is populated from Supabase's JWT, not Clerk's; (2) minimum cost $25/mo; (3) maintaining two auth systems (Clerk for identity, Supabase for RLS) creates a synchronization surface that breaks in subtle ways when users are deleted or roles change. |
| Auth.js (NextAuth) | Good for OAuth-heavy products. Rejected because: Supabase RLS requires Supabase's JWT structure. Auth.js sessions require a custom adapter to emit Supabase-compatible JWTs and keep sessions synchronized with Supabase's session store. High integration risk for a small team.                                                                                                                                                                                                                |
| Custom JWT         | Full control but high implementation risk. Password hashing, token refresh, session invalidation, email verification, and password reset flows are all non-trivial to implement securely. A small team building a platform on a 6–10 week MVP timeline should not be writing custom auth.                                                                                                                                                                                                        |

### Why Supabase Auth wins for this project

`auth.uid()` in RLS policies is the load-bearing reason. Every ownership check on the platform — can this user edit this listing, can this user view this verification document, can this user see their own saved listings — is expressed as `auth.uid() = owner_user_id` or `auth.uid() = submitted_by` in an RLS policy. Supabase Auth populates `auth.uid()` automatically from the session JWT. Any other auth provider requires a synchronization mechanism to get the user's ID into the Supabase JWT context, which is a custom integration surface with a failure mode.

The `@supabase/ssr` package handles httpOnly cookie management in the Next.js App Router, including session refresh and middleware integration. This is not trivial to build correctly — session tokens must not be accessible to JavaScript (XSS protection), must refresh before expiry, and must be validated server-side on every request. `@supabase/ssr` handles all of this.

Roles are stored in `user_roles` rather than in the JWT claim because JWT claims are cached until token expiry. An admin who has their role revoked must not regain access until the token expires — storing roles server-side means a role check is always a live database query.

### Known risks

Supabase Auth is less feature-rich than Clerk for user management UI. There is no built-in admin console for browsing, searching, and managing users. Mitigation: admin user management is built into the `/admin/users` route of the platform itself, using the Supabase Admin API (service role key, server-side only).

Google OAuth is deferred to V1. The reason is not complexity — it is reducing the MVP surface area. Email/password covers all user types at launch.

### Upgrade / replacement

No replacement planned.

---

## 8. Storage — Supabase Storage

### Decision

Supabase Storage for all user-uploaded media. Three buckets: `listing-media` (public), `verification-docs` (private, admin-only), `receipts` (private, owner-only). Storage paths are stored in the database; CDN URLs are generated at read time.

### Alternatives evaluated

| Alternative   | Why rejected                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWS S3        | Most mature option. Rejected because: adds a separate AWS credential surface (IAM users, access keys, bucket policies); no native Supabase Auth integration for private bucket access; adds operational overhead for a small team managing an already multi-surface stack.                                                                                 |
| Cloudflare R2 | Cost-effective (no egress fees), S3-compatible API. Rejected because: still adds a separate service; no auth-integrated bucket policy model; adds another vendor relationship to manage.                                                                                                                                                                   |
| Uploadthing   | Excellent DX for Next.js file uploads. Rejected because: another vendor; less control over private bucket policy; no integration with Supabase Auth for access control. At the scale of a few thousand uploads, Uploadthing is fine — but the verification document bucket has strict access requirements that are easier to enforce natively in Supabase. |

### Why Supabase Storage wins for this project

The verification documents bucket (`verification-docs`) is the deciding factor. These documents — business licenses, EINs, identity documents submitted for the `trust_tier = 'verified'` workflow — must never be publicly accessible. Supabase Storage's bucket policies use the same RLS model as the database: `auth.uid()` in `auth.role() = 'admin'` checks on the `storage.objects` table. This means the same RLS primitives protect both the database and the storage layer. A separate storage provider would require a custom signed URL server or a separate access control implementation.

For `listing-media` (public logos, covers, gallery images), Supabase's CDN serves them globally with no additional configuration. The URL pattern is predictable and generated at read time from stored paths — this is the correct pattern. Storing CDN URLs would break if the storage provider changes.

### Known risks

Supabase Storage's CDN coverage is less globally distributed than Cloudflare CDN or AWS CloudFront. At MVP traffic levels, this is immaterial. At V1 scale (50K monthly visitors), media load time from Supabase's CDN is monitored. If image-heavy BLACQList Pages show poor performance in regions far from Supabase's CDN nodes, a Cloudflare CDN layer in front of Supabase Storage paths is evaluated. This is a day-of-configuration change, not an architectural migration.

### Upgrade / replacement

Storage paths in the database (not URLs) mean the storage provider can change without a data migration — only the URL generation utility needs updating. If Supabase Storage CDN becomes a performance bottleneck, Cloudflare R2 with a compatible path-based URL scheme is the upgrade path.

---

## 9. Search — PostgreSQL FTS at MVP, Algolia at Scale

### Decision

PostgreSQL full-text search (`tsvector` + `GIN` index + `pg_trgm`) at MVP and early V1. Algolia as the documented upgrade path when defined triggers are hit.

### MVP search architecture

A `search_vector` column of type `tsvector` on the `listings` base table, automatically maintained by a trigger that regenerates the vector on any relevant field change. The vector is a weighted combination of:

| Field                            | Weight      | Rationale                                            |
| -------------------------------- | ----------- | ---------------------------------------------------- |
| `name`                           | A (highest) | Business name is the most intent-aligned signal      |
| Category name (denormalized)     | B           | Category is the second most common search intent     |
| `tagline`                        | B           | Punchy descriptor that often matches user vocabulary |
| Description (business/event/job) | C           | Longer-form content, lower precision                 |
| City name                        | D           | Geo context — supports "barbershop Atlanta" queries  |
| Social and contact fields        | Excluded    | Not search-relevant                                  |

A `GIN` index on `search_vector` keeps query times below 100ms at 5,000 listings. `pg_trgm` with a `GIN` index on `listings.name` handles typo-tolerant name matching ("Sweet Aubrn BBQ" → "Sweet Auburn BBQ").

### Why not Algolia at MVP

Algolia charges per search operation. At MVP launch, search volume is unknown. A 300-listing seed dataset with an unproven traffic baseline does not justify the operational overhead of keeping an Algolia index synchronized with Supabase on every listing create/update/delete. The synchronization pipeline is non-trivial: it requires a webhook or trigger to push changes to Algolia's API on every relevant mutation. At MVP scale, this is more engineering time than the search quality benefit warrants.

PostgreSQL FTS handles the MVP search requirement. "Find a Black-owned barbershop in Atlanta" with a keyword + city + category filter is a `WHERE tsvector @@ plainto_tsquery() AND city_id = ? AND category_id = ?` query. That works fine at 5,000 listings.

### Upgrade trigger

The upgrade to Algolia is triggered by **any one** of the following:

1. Search p95 latency consistently above 300ms for two consecutive weeks
2. Total published listings exceed 50,000
3. User research identifies synonym failures at a rate that impacts conversion ("barber" not finding "barbershop")
4. AI-assisted discovery (V2) requires vector similarity search — at that point, Algolia's neural search or `pgvector` is evaluated together

### Why Algolia over Typesense for the upgrade

| Factor                   | Algolia                                               | Typesense                                                |
| ------------------------ | ----------------------------------------------------- | -------------------------------------------------------- |
| Managed reliability      | SLA-backed, globally distributed                      | Self-hosted or managed cloud (higher ops burden)         |
| React integration        | InstantSearch for React is mature and well-documented | Typesense InstantSearch exists but smaller community     |
| Neural / semantic search | Available (Algolia NeuralSearch)                      | Available but less mature                                |
| Cost                     | $0.50/1K searches                                     | Cheaper at scale, but infrastructure management overhead |
| Index sync tooling       | Official Supabase + Algolia integration documented    | Requires custom sync pipeline                            |

For a small team on a managed hosting stack, Algolia's operational simplicity at V2 scale outweighs Typesense's cost advantage. The cost difference becomes relevant at high search volume — at that point, the team has more operational capacity to evaluate self-hosted options.

### Known risks

Search quality at MVP is noticeably inferior to Algolia for edge cases: pluralization ("businesses" vs. "business"), synonym expansion ("food" vs. "restaurant"), and semantic similarity ("natural hair" finding a stylist who lists "locs and braids"). These are V2 concerns. The MVP search user is searching with reasonable intent — keyword + category + city — and PostgreSQL FTS handles that acceptably.

### Upgrade / replacement

PostgreSQL FTS → Algolia at the defined triggers. `pgvector` for embedding-based similarity search is evaluated at V2 alongside the AI features tier. If `pgvector` provides sufficient semantic search capability within Supabase, Algolia may be deferred further.

---

## 10. Email — Resend + React Email

### Decision

Resend for transactional email delivery. React Email for template authoring.

### Alternatives evaluated

| Alternative | Why rejected                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SendGrid    | Industry standard. Rejected because: template authoring is HTML string editing or a drag-and-drop builder — not JSX. For a team working in React and TypeScript, switching to HTML-based email templates is a context switch that produces inconsistent brand output. Deliverability is strong but not decisively better than Resend for a platform at this scale. |
| Postmark    | Excellent deliverability, especially for transactional email. Rejected because: no React Email integration at a supported level; template authoring is Handlebars-based.                                                                                                                                                                                           |
| AWS SES     | Cheapest at scale (approximately $0.10 per 1,000 emails). Rejected because: SES requires manual deliverability configuration (DKIM, SPF, DMARC, feedback loop setup, sandbox removal process) that adds operational overhead before the first email is sent. Not appropriate for a small team launching on a deadline.                                             |

### Why Resend wins for this project

React Email templates are JSX components. Every email template uses the same design tokens, component patterns, and TypeScript types as the web application. A developer adding a new transactional email (claim approved, review notification, subscription renewal) authors it in the same environment as the rest of the codebase — no context switch. The branding is consistent by default because the design system tokens are shared.

Resend's free tier is 3,000 emails per month. MVP transactional email volume (claim confirmations, password resets, verification notifications) is well within this. At V1 scale, the Pro plan ($20/mo for 50,000 emails) accommodates the review notification and listing expiry reminder workflows.

### Known risks

Resend is a newer provider with a shorter deliverability track record than SendGrid or Postmark. Mitigation: domain authentication (SPF, DKIM, DMARC) is configured at Phase 0. Bounce and spam rates are monitored from the first week of live traffic. If deliverability issues appear, migration to SendGrid is a 1-day swap — React Email templates are provider-agnostic; only the Resend SDK call is replaced.

### Upgrade / replacement

Resend → SendGrid if deliverability monitoring shows systematic issues. No planned migration otherwise.

---

## 11. Payments — Stripe

### Decision

Stripe for all payment flows. V1: Stripe subscriptions for listing tier upgrades. V2: Stripe Connect for marketplace vendor payouts.

### Alternatives evaluated

| Alternative        | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paddle             | Handles VAT/sales tax automatically — a genuine advantage for international SaaS. Rejected because: Paddle does not have an equivalent of Stripe Connect for marketplace vendor payouts. The platform's V2 roadmap requires paying out to vendors for marketplace orders. Introducing Paddle for V1 subscriptions and then Stripe for V2 payouts means running two payment providers — which is worse than running Stripe for both phases. |
| LemonSqueezy       | Excellent DX for simple SaaS subscriptions. Rejected for the same reason as Paddle: no Connect-equivalent for marketplace payouts.                                                                                                                                                                                                                                                                                                         |
| Braintree (PayPal) | Technically supports marketplace payouts. Rejected because: developer experience is significantly worse than Stripe; fewer Next.js integration examples; PayPal association may create trust concerns for a community platform where cultural credibility matters.                                                                                                                                                                         |

### Why Stripe wins for this project

Stripe is the only provider in the evaluation that handles both V1 subscription billing and V2 marketplace payouts on a single platform with a single API surface and a single vendor relationship. Introducing a second payment provider to handle what the other cannot creates integration complexity, split billing dashboards, and a larger attack surface for financial data.

The V1 → V2 payment transition is designed for continuity: V1 Stripe customers are already Stripe customers; their payment methods are already stored in Stripe's vault. When V2 marketplace goes live, the same customer objects and payment methods are used — no re-enrollment.

Stripe Radar provides fraud detection for marketplace transactions at V2 without additional integration.

**Critical V2 prerequisite:** Stripe Connect application approval requires a business review by Stripe. This process can take 2–4 weeks and may require documentation. The application must be submitted at V1 start, not V2 start. If the application is delayed, V2 launch is delayed. This is documented here as a risk, not discovered when V2 development begins.

### Known risks

Stripe Connect KYC friction at vendor onboarding. Vendors must complete identity verification before receiving payouts. Some vendors will abandon the onboarding flow. Mitigation: the storefront setup UX treats Stripe Connect onboarding as a separate, later step from listing creation — a vendor can set up their Page and product catalog before completing Connect onboarding. The marketplace CTA is gated on Connect status.

### Upgrade / replacement

No replacement planned. Stripe is the industry standard for good reasons and the platform commitment to Stripe from V1 removes incentive to evaluate alternatives at V2.

---

## 12. AI — Anthropic Claude API

### Decision

Anthropic Claude API for all AI features at V2+. All AI calls are server-side only — no client-side API calls, no key exposure. All prompts are versioned in `lib/ai/prompts/`.

### Alternatives evaluated

| Alternative             | Why rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI GPT-4o           | Strong capability, dominant market share, excellent API. Rejected for two reasons: (1) OpenAI's model training data usage policies create a concern for a community-trust platform where user-submitted business content may be ingested into training pipelines — this is a brand alignment issue for The BLACQList; (2) Anthropic's Claude models have demonstrated stronger performance on nuanced content generation tasks (business description writing, reasoning traces) in the use cases this platform needs. |
| Cohere                  | Strong for semantic embeddings and RAG. Weaker for the conversational discovery and content generation use cases that define V2 AI features.                                                                                                                                                                                                                                                                                                                                                                          |
| Google Gemini           | Improving but less established API ecosystem, fewer Next.js integration patterns, and trust positioning is less aligned with the platform's community values.                                                                                                                                                                                                                                                                                                                                                         |
| On-device / edge models | Insufficient capability for conversational discovery (requires multi-turn reasoning with ranking) and description generation (requires brand-appropriate writing quality).                                                                                                                                                                                                                                                                                                                                            |

### Why Anthropic wins for this project

The V2 AI features are: (1) business description optimization suggestions — Claude evaluates a business description and returns specific, actionable improvements with reasoning; (2) shopper-side conversational discovery — a user types "I want to find a Black-owned florist in Houston for a wedding" and Claude returns ranked results with reasoning. Both require long-context reasoning, nuanced content quality, and clear confidence signals. Claude's extended thinking and reasoning trace capabilities are well-suited to the second use case.

Anthropic's mission alignment with The BLACQList's community-trust positioning matters for brand coherence. The platform's trust tier is central to its identity — the AI provider should reinforce, not undermine, that positioning.

**Server-side only is a hard constraint.** The Claude API key is a server-side secret. It is never referenced in any Client Component, never included in any API response, and never logged. All AI inference calls are routed through `lib/ai/` service functions called from Server Components or Server Actions. Client Components receive the output of AI inference, never the API surface itself.

### Known risks

Anthropic API pricing is higher than OpenAI at equivalent capability tiers. Mitigation: the platform's AI use cases are bounded. Description generation is a one-time action per listing (not per page view). Conversational discovery sessions are metered per query. At V2 scale (5,000 listings, not millions of daily AI queries), pricing is manageable. If Claude's pricing becomes untenable relative to competitors, the `lib/ai/` abstraction layer means the API provider is swapped in one file — prompts and service logic are provider-agnostic.

### Upgrade / replacement

The API abstraction in `lib/ai/` is designed for provider portability from day one. A provider swap is a 1-day change. If OpenAI resolves the training data policy concerns, or if a new model demonstrates superior performance on the platform's specific use cases at lower cost, migration is straightforward. Timeline: evaluate annually at V2+ phases.

---

## 13. Analytics — Vercel Analytics + Custom Events Table

### Decision

Vercel Analytics for Core Web Vitals and page-level traffic metrics at MVP. A custom `analytics_events` table in Supabase for business-owner-facing metrics (page views, CTA clicks, saves, shares) at V1. PostHog added at V1 for product analytics.

### Alternatives evaluated

| Alternative         | Why rejected (at MVP)                                                                                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostHog immediately | Open source with strong product analytics, self-hostable, good Next.js integration. Deferred to V1, not rejected — PostHog is the documented V1 addition. MVP does not yet have validated metrics to analyze; adding full product analytics before there is data to act on is premature. |
| Amplitude           | Enterprise-grade funnel and cohort analysis. Rejected: pricing tier is higher than justified at MVP; product analytics maturity beyond MVP needs.                                                                                                                                        |
| Mixpanel            | Strong funnel analytics, but another vendor relationship and cost. Deferred in favor of PostHog's data ownership model.                                                                                                                                                                  |
| Google Analytics 4  | Free. Rejected: data ownership concerns for a community platform; GA4's event model is less developer-friendly than PostHog; the platform's community-trust positioning makes data sovereignty a relevant consideration.                                                                 |

### Why this combination works

At MVP, Vercel Analytics provides Core Web Vitals monitoring with zero configuration — this is actionable data (is the platform fast? are BLACQList Pages passing LCP thresholds?) that does not require a custom analytics implementation.

The `analytics_events` table in Supabase records business-owner-visible events: page views per listing, CTA clicks, save events, and share events. These feed the business owner analytics dashboard (V1 feature). This data must live in the platform's own database — it is user-facing data that drives owner engagement and subscription value, not third-party analytics data that lives in an external system.

PostHog at V1 adds funnel analysis (which steps of claim/create flow have high drop-off?), session recording for UX debugging, and cohort analysis (do verified businesses have higher CTA click rates than unclaimed ones?). PostHog's open-source model and self-hostable option align with the platform's data ownership values.

### Known risks

Vercel Analytics alone is insufficient for product analytics decisions. This is a documented V1 gap, not an oversight. PostHog is added at V1 as a planned action, not a reactive fix.

### Upgrade / replacement

Vercel Analytics is a permanent baseline (Core Web Vitals). PostHog is added at V1. GA4 is not introduced. No replacement for PostHog is planned.

---

## 14. Hosting — Vercel

### Decision

Vercel for all hosting. Edge Network for CDN. Preview deployments on every PR. Serverless functions for API routes and Server Actions.

### Alternatives evaluated

| Alternative            | Why rejected                                                                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Railway                | Excellent DX for containerized backend services. Less optimized for Next.js ISR/SSR — cache management, edge middleware, and preview deploys require custom configuration that Vercel provides out of the box.                                                                    |
| Fly.io                 | Strong for always-on, globally distributed server processes. Better fit for long-running backend services than for a Next.js application with spiky discovery page traffic. Serverless edge model is more cost-efficient for the platform's traffic pattern.                      |
| AWS Amplify            | Strong CDN, but Next.js App Router support has historically lagged behind Vercel. App Router features (Server Components, Server Actions, streaming) are best supported on Vercel infrastructure.                                                                                 |
| Self-hosted on AWS/GCP | Full control and lowest cost at scale. Rejected: adds infrastructure management responsibility for a small team. CI/CD, health checks, autoscaling, TLS certificates, CDN configuration — all managed by Vercel at MVP and V1. Re-evaluate at V3+ if costs justify the migration. |

### Why Vercel wins for this project

Next.js is co-developed with Vercel. ISR cache management — the core mechanism that makes BLACQList Pages cost-efficient at scale — is handled automatically by Vercel's infrastructure. `revalidatePath()` and `revalidateTag()` calls purge the Vercel edge cache for the correct pages when listings are updated. No custom cache invalidation logic is required.

Preview deployments on every PR allow non-technical stakeholders (brand team, community advisors) to review BLACQList Page designs and admin interface changes before they merge. For a platform where community trust and visual quality are core to the value proposition, this feedback loop has direct product value.

Vercel Edge Functions run middleware at the CDN layer — session validation for auth-protected routes happens before a request hits a serverless function, reducing cold start costs and protecting against unauthenticated data exposure at the edge.

### Known risks

**Vercel cost scaling** is the most realistic future risk. Serverless function invocations and bandwidth both scale with traffic. At 1M monthly requests (the platform's maturity target), Vercel costs require an audit. Mitigation: ISR reduces function invocations for entity pages to approximately 1 per cache miss (once per hour under load, not once per visitor). API routes and Server Actions are the primary cost drivers at scale. Cost alerts are configured at V1.

If Vercel costs become prohibitive at V3+ scale, the migration path is: containerize the Next.js application, host on Railway or a managed Kubernetes cluster, replace Vercel's CDN with Cloudflare, and manage ISR cache invalidation via Cloudflare's cache API. This is a significant engineering investment — justified only if Vercel's pricing at scale exceeds the engineering cost of the migration.

### Upgrade / replacement

No planned replacement. Cost review at V3 (1M monthly request scale).

---

## 15. Error Tracking — Sentry

### Decision

Sentry for error tracking and performance monitoring, introduced at Phase 0.

### Alternatives evaluated

| Alternative              | Why not chosen                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datadog                  | More comprehensive observability platform, but higher cost and more configuration overhead than needed at MVP. Sentry's developer-centric DX is better suited to a small team.                 |
| Bugsnag                  | Solid alternative to Sentry. Sentry has wider Next.js App Router integration documentation and a more active community around the specific patterns this platform uses.                        |
| No error tracking at MVP | Not acceptable. A live, publicly accessible platform with user-created data and auth flows must have error visibility from day one. Discovering errors through user reports is not a strategy. |

### Why Sentry at Phase 0

Errors on a discovery platform cause two categories of harm: user-facing failures (a BLACQList Page 500s, a claim submission fails silently) and data integrity failures (a listing saves with partial data, an RLS policy blocks a legitimate write without surfacing the error). Both require immediate visibility. Sentry's source map integration means stack traces reference the original TypeScript source — not the compiled output — making debugging faster.

Sentry's performance monitoring adds p95/p99 latency tracking for API routes and Server Actions without a separate APM tool. At MVP, this covers the search endpoint, the listing create/edit flow, and the claim submission flow — the three performance-critical user paths.

### Upgrade / replacement

Sentry covers all phases. No replacement planned. Datadog APM is evaluated at V3+ if the team needs infrastructure-level observability beyond what Sentry provides.

---

## 16. Risk Register

| Risk                                                                                           | Likelihood               | Impact | Mitigation                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase vendor lock-in makes future migration prohibitive                                     | Medium                   | High   | All database queries encapsulated in `lib/services/` using standard SQL. Storage paths (not URLs) stored in DB. Auth flows abstracted behind a service layer. Migration is expensive but feasible.   |
| Search quality failures at 50K+ listings drive user dissatisfaction before Algolia is deployed | High                     | Medium | Algolia upgrade path is documented and pre-scoped. Trigger conditions are specific and monitored. The upgrade is a planned event, not a reactive emergency.                                          |
| Stripe Connect application delay blocks V2 marketplace launch                                  | Medium                   | High   | Connect application submitted at V1 start, not V2 start. This gives 10–14 weeks of buffer. Timeline risk is flagged to the business at V1 planning.                                                  |
| Vercel cost spikes at V1 traffic levels exceed budget                                          | Low at MVP, Medium at V1 | Medium | ISR reduces per-request function cost for entity pages. Cost monitoring alerts configured at V1. Mitigation budget is identified before costs become a crisis.                                       |
| Next.js App Router instability from upstream changes breaks production builds                  | Low                      | Medium | Only stable, documented patterns are used. No bleeding-edge App Router features (parallel routes, intercepting routes) at MVP. Framework updates are tested on staging before merging to production. |

---

## 17. Later Replacement Points

This is the explicit list of stack layers that are expected to change and when. Everything not on this list is expected to hold for the platform's lifetime.

| Layer             | Current choice                   | Replacement                  | Trigger                                                                                              |
| ----------------- | -------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| Search            | PostgreSQL FTS                   | Algolia                      | p95 latency > 300ms sustained, OR > 50K listings, OR synonym failure rate confirmed in user research |
| Analytics         | Vercel Analytics + custom events | + PostHog added at V1        | V1 start — this is a planned addition, not a replacement                                             |
| AI model provider | Anthropic Claude                 | Potentially another provider | Annual evaluation at V2+; `lib/ai/` abstraction makes this a 1-day swap if justified                 |
| Mobile            | Next.js web app                  | React Native app             | V4 scale; shares business logic in `lib/` but requires a separate app codebase                       |
| Auth              | Supabase Auth                    | No planned replacement       | Supabase Auth covers all phases; Google OAuth added at V1 within the same provider                   |
| Hosting           | Vercel                           | Containerized self-hosting   | V3+ cost review; only if Vercel pricing at 1M+ monthly requests exceeds migration cost               |
| Payments          | Stripe                           | No planned replacement       | Stripe handles both V1 subscriptions and V2 Connect — no reason to introduce a second provider       |

---

## How to Use This Document

**When evaluating a new library or service:** Check whether the decision it touches is recorded here. If a stack layer is decided, the evaluation was already done. Raising an alternative requires reading this document first and identifying a specific failure in the recorded reasoning — not a general preference.

**When hitting a scale limit:** Check the risk register and later replacement points before initiating an architectural change. The triggers are specific — do not initiate a migration before the documented trigger condition is confirmed.

**When a new phase begins:** Review the "Phase introduced" column in the stack summary. Each phase introduces new layers (Stripe at V1, Algolia potentially at V2, Claude at V2). Ensure the decisions for the upcoming phase are confirmed before the phase begins — do not discover the Stripe Connect application timeline at V2 start.

**When this document needs updating:** Any change to a decided layer requires updating this document before the change is implemented. The document is the decision record — implementation that diverges from the document without updating it creates a documentation debt that compounds.
