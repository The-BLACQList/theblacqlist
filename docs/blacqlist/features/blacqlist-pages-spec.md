# BLACQList Pages — Feature Specification

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product / UX
**Audience:** Engineering, Design, QA, Admin

This document is the authoritative specification for every BLACQList Page template. An engineer and designer must be able to read it and build any BLACQList Page type — from a Business Page at MVP to a Vendor Storefront at V2 — without a verbal briefing. Every section, field, state, phase boundary, accessibility requirement, and analytics event is defined here.

---

## 1. Purpose and Principles

### What a BLACQList Page Is

A BLACQList Page is the atomic public unit of The BLACQList platform. Every listed entity — whether a restaurant in Atlanta, a graphic designer in Chicago, an event in Houston, or a job opening in Los Angeles — receives a BLACQList Page. It is not a profile, a form submission, or a directory listing. It is a conversion-focused, shareable, SEO-indexed micro-website that represents the entity with the depth and visual quality it deserves.

A BLACQList Page serves three audiences simultaneously:
- **The visitor** who needs to find, trust, and act on what they discover.
- **The entity owner** who needs a professional digital presence that represents them at full value.
- **The platform** which needs every Page to reinforce the brand promise, accumulate SEO equity, and drive community engagement.

### What a BLACQList Page Is Not

A BLACQList Page is not a user profile. It is not an editable wiki. It is not a plain directory record. It is not a Google Business Profile with Black branding applied. Every design and content decision must be evaluated against whether it raises or lowers the standard of what a Black-owned entity's digital presence can look like.

### Non-Negotiable Design Principles

1. **Every Page must look meaningfully better than a Google Business Profile or Yelp listing on every dimension it shares.** This is the product's core promise. It is not aspirational — it is a launch-day quality gate.

2. **Amber Gold (`#E2A428`) is the action color, not the brand color.** It appears on primary CTAs, trust badges, claimed states, and save-state fills. It does not appear in body copy, background fills, or decorative elements. Its presence must always signal: "something you can do or have earned."

3. **Every section that has nothing to show must either hide completely or show a contextually appropriate empty state — never a blank void.** The public-facing Page must never look unfinished because an owner has not yet completed a section. Show what exists; hide what does not.

4. **Pages are composed from a shared section library, not built per entity type from scratch.** Sections are defined once and configured per entity type. Adding a new entity type means mapping existing sections, not building new ones. This constrains complexity and keeps Pages visually consistent.

5. **The primary CTA must be visible without scrolling on both desktop and mobile at all times once the hero scrolls out of view.** The Quick Action Bar enforces this. No entity type is exempt. The bar appears, sticks, and persists. Conversion is not optional.

---

## 2. Entity Type Overview

| Entity Type | Route Pattern | Introduced | Top-level vs Sub-page | Primary CTA Type(s) | Who Manages the Page |
|---|---|---|---|---|---|
| Business | `/[city-slug]/business/[listing-slug]` | MVP | Top-level | Book, Order, Call, Visit, Message | Business owner (Claimed) or Admin (Unclaimed) |
| Professional | `/[city-slug]/professional/[listing-slug]` | Beta (feature-flagged) | Top-level | Book Consultation, Contact, Visit Profile | Professional (Claimed) or Admin |
| Creative | `/[city-slug]/creative/[listing-slug]` | Beta (feature-flagged) | Top-level | Commission, Book, Contact | Creative (Claimed) or Admin |
| Event | `/events/[event-slug]` | Beta (feature-flagged) | Top-level | Get Tickets, RSVP, Learn More | Event organizer (Claimed) or Admin |
| Job | `/jobs/[job-slug]` | Beta (feature-flagged) | Top-level | Apply Now | Employer or Admin |
| Marketplace Vendor | `/marketplace/vendor/[vendor-slug]` | V2 | Top-level | Shop Now, View Products | Vendor (Claimed) or Admin |
| Product | `/marketplace/product/[product-slug]` | V2 | Sub-page (under Vendor) | Add to Cart, Buy Now | Vendor (inherits from parent) |
| Service | Nested under parent Page | V1 | Sub-page (under Business or Professional) | Book, Request Quote | Parent Page owner |

**Notes on sub-pages:**
- Product Pages are not independent entities. They are owned by their parent Vendor Page and inherit the vendor's trust tier, claim status, and brand assets.
- Service sub-pages are lightweight — they present a single service in detail. They do not have their own hero or trust section; they inherit from the parent Business or Professional Page.
- Product and Service sub-pages do not appear in section 9 (Platform Activity) counts — saves and views roll up to the parent top-level Page.

---

## 3. Section Specifications

---

### Section 1: Hero

**Purpose:**
The Hero is the first thing a visitor sees and the last thing they should need to see to decide whether to act. It establishes who the entity is, makes the primary action immediately available, and communicates trust tier and save/share affordances — all before the user scrolls. For business owners, the Hero is the most important piece of real estate on their Page: it is the first impression that decides whether a visitor stays or bounces. For visitors, it answers "Is this the right place?" within 3 seconds of arrival.

**Applies to:** Business, Professional, Creative, Event, Job, Vendor, Product, Service

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Cover image | Image (object-fit cover) | All | No (has default fallback) | Max 10MB upload; 16:9 recommended; 1920×1080px ideal; served via CDN; OG image source |
| Entity name | Text | All | Yes | Glacial Indifference Bold; white on overlay; max 60 chars displayed before truncation |
| Tagline | Text | Business, Professional, Creative, Vendor | No | Lato Regular; white on overlay; max 80 chars; shown below name |
| Trust badge | Badge component | Business, Professional, Creative, Vendor | Yes (system-assigned) | Position: lower-right of hero on desktop; below name on mobile |
| Primary CTA button | Button (Amber Gold) | All | Yes (owner-configured or system default) | Label is owner-configured for Business, Professional, Creative, Vendor; fixed label for Event ("Get Tickets"), Job ("Apply Now"), Product ("Add to Cart") |
| Save button | Icon button | All top-level Pages | Yes (always visible) | Bookmark icon; Cream fill when unsaved; Amber Gold fill when saved; visible to all; auth-gated on tap for anonymous users |
| Share button | Icon button | All top-level Pages | Yes (always visible) | Share icon; Cream; triggers share sheet or copy-link modal |
| Event date/time badge | Badge | Event | Yes for Event | Shown in hero overlay; format: "Sat, Jun 14 · 7:00 PM" |
| Job company + location badge | Badge | Job | Yes for Job | Shown in hero overlay; format: "[Company] · [City or Remote]" |
| Product price | Text | Product | Yes for Product | Shown in hero; Amber Gold text; format: "$XX.XX" or "From $XX.XX" |
| Overlay gradient | Design element | All | System-applied | Bottom-to-top linear gradient over cover image to ensure text legibility; Brand Black at 60% opacity at the bottom, transparent at top |

**MVP behavior:**
Available for Business entity type only. Hero renders with: cover image (or Deep Background `#19191E` fallback with the BLACQList wordmark centered if no image is uploaded), business name in Glacial Indifference Bold at 40px (desktop) / 28px (mobile), tagline in Lato Regular at 18px, trust badge in lower-right, Amber Gold primary CTA button with owner-configured label, and Save + Share icon buttons. Cover image is uploaded via the owner dashboard. The gradient overlay is always applied when a cover image exists.

**Later behavior:**
- Beta: Hero available for Professional, Creative, Event, Job entity types with type-specific badge content (event date, job company/location).
- V1: Video background support as an alternative to a static cover image (owner-configurable; desktop only; falls back to still frame thumbnail on mobile). Hero layout option for Premium tier owners: expanded hero with logo positioned in lower-left alongside name instead of above.
- V2: Product hero with product image carousel (up to 5 images) replacing the single cover image. Vendor hero with storefront cover image + logo lockup.

**Empty state:**
If no cover image has been uploaded: the hero renders with a full-bleed Deep Background (`#19191E`) fill. The entity name and other overlay elements render normally. No "Add a cover image" prompt is visible on the public-facing Page — that prompt lives exclusively in the owner dashboard completion checklist. The absence of a cover image is not surfaced as incompleteness to visitors.

**Editability by owner:**
- Cover image: upload via dashboard Page Editor > Hero section. Max 10MB. JPEG, PNG, WebP accepted. Square crop tool provided; 16:9 aspect ratio enforced as the output. Old image replaced on new upload; old image deleted from storage after 24h (deferred cleanup job).
- Entity name: editable in dashboard > Hero section. Business name has a 100-character hard limit stored in the database; display truncates at 60 characters with an ellipsis in the hero.
- Tagline: editable in dashboard > Hero section. 80-character limit enforced in the form.
- Primary CTA label + destination: editable in dashboard > CTA section (see Section 7 for full CTA configuration).
- Trust badge: not owner-editable; system-assigned based on claim/verification status.

**Admin moderation needs:**
- Replace cover image on any listing (override owner image with admin-uploaded image if the image is inappropriate or low quality).
- Override trust badge tier independently of the claim flow (e.g., manually setting Verified without going through the full verification queue).
- Force-republish hero when changes are made directly in the admin listing editor.

**SEO needs:**
- Entity name is used verbatim in the `<title>` tag and `og:title`. It must not be truncated in the `<title>` value even if the visual hero truncates.
- Cover image is the source for `og:image` via the `/og/[...params]` dynamic image generation route. The OG image renders the cover image with the entity name and BLACQList wordmark overlaid using Satori or equivalent server-side image generation. Dimensions: 1200×630.
- The hero section's entity name heading uses `<h1>` — there is exactly one `<h1>` per Page.
- Cover image `<img>` has `alt="[Entity Name] — [Category] in [City]"`.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `page_view` | Page is loaded | `entity_type`, `entity_id`, `listing_slug`, `city_slug`, `trust_tier`, `is_claimed`, `referrer_source` |
| `hero_cta_click` | Primary CTA button in hero is clicked | `entity_type`, `entity_id`, `cta_type`, `cta_label`, `trust_tier` |
| `save_toggled` | Save button in hero is clicked | `entity_type`, `entity_id`, `action` (`saved` or `unsaved`), `auth_state` (`authenticated` or `auth_gated`) |
| `share_initiated` | Share button in hero is clicked | `entity_type`, `entity_id`, `share_method` (`copy_link`, `native_share`, `social`) |

**Design notes:**
The hero occupies 60% of the viewport height on desktop (max 600px), 50% on mobile (max 400px). The entity name renders left-aligned in the lower quarter of the hero area, above the tagline, above the CTA row. The CTA row contains: primary CTA button (Amber Gold, `px-8 py-3`, Quicksand Bold Italic), Save button (icon, 44×44px tap target), Share button (icon, 44×44px tap target). On mobile, the CTA row stacks: primary CTA button full-width, Save and Share buttons as a pair below it at 50% width each.

The trust badge renders at 24px height, positioned absolute in the lower-right of the hero container. Unclaimed: Pale Lavender background with Charcoal text "Unclaimed". Claimed: Amber Gold background with Brand Black text "Claimed". Verified (V1): gradient gold-to-amber background with white text "Verified" and a checkmark icon. BLACQList Certified (V1): Amber Gold with Brand Black star icon + "Certified" text.

**Mobile behavior:**
At 375px: hero is 50vh (minimum 320px, maximum 400px). Entity name renders at 24px. Tagline renders at 14px. The CTA button is full-width below the name/tagline, minimum 56px height. Save and Share buttons are 44×44px circles positioned in a row below the CTA. The overlay gradient extends from the bottom 70% of the image area (deeper than desktop) to ensure legibility at smaller sizes. The hero trust badge is 20px height, still positioned in the lower-right but with 12px margin from the edge.

---

### Section 2: Quick Action Bar

**Purpose:**
The Quick Action Bar is the Page's persistent conversion rail. Once the visitor scrolls past the hero — and the hero's primary CTA disappears from view — the Quick Action Bar snaps into a fixed position at the top of the viewport (below the main nav bar) and stays there for the entire scroll. It presents the same primary CTA, plus phone and map quick-tap links and the save/share buttons, in a compact horizontal strip. Its presence eliminates dead zones in the scroll: no matter how far into the Page a visitor reads, the path to action is always one tap away.

**Applies to:** Business, Professional, Creative, Event, Job, Vendor, Product, Service

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Primary CTA button | Button (Amber Gold, compact) | All | Yes | Same label and action as hero CTA; compact variant: `px-4 py-2` |
| Phone quick-tap | Icon + text link | Business, Professional, Creative, Vendor | Conditional | Shows only if phone number exists; `tel:` link; phone handset icon |
| Map/directions quick-tap | Icon + text link | Business, Professional, Creative, Event | Conditional | Shows only if address exists; map pin icon; opens Google Maps or Apple Maps via OS detection |
| Save button | Icon button | All top-level Pages | Yes | Bookmark icon; matches save state from hero; 44×44px |
| Share button | Icon button | All top-level Pages | Yes | Share icon; 44×44px |
| Entity name (condensed) | Text | All | Yes (for context) | Short entity name in Lato Medium, 14px, truncated at 24 characters; confirms to the visitor which Page they are on |

**MVP behavior:**
Available for Business only. Bar contains: condensed entity name (left), primary CTA button (center-right, Amber Gold), phone icon link if phone exists (right of CTA), map icon link if address exists (right of phone), Save and Share icons (far right). Bar is a Client Component using `IntersectionObserver` to detect when the hero CTA button leaves the viewport — it becomes `position: fixed; top: [nav-height]px` at that moment. The bar is hidden when the user scrolls back up and the hero CTA re-enters the viewport.

**Later behavior:**
- Beta: Available for Professional, Creative, Event, Job entity types. Event bar shows a "Get Tickets" button and a location map link. Job bar shows an "Apply Now" button and the application deadline if present.
- V1: Quick Action Bar appears in a slightly elevated state for Verified and BLACQList Certified entities — a subtle certification indicator (small gold star, no text) appears to the left of the entity name within the bar.

**Empty state:**
The bar is never in an empty state — it is a layout component. If phone and map data do not exist, those icon buttons are simply absent. The bar always contains at minimum the entity name, the primary CTA, and the Save + Share buttons. The bar never shows with zero interactive elements.

**Editability by owner:**
No direct editing of the bar — it reflects the phone number, address, and CTA type already configured elsewhere in the Page Editor. The bar composition updates automatically when those source fields are updated.

**Admin moderation needs:**
None specific to this section. The bar is derived from other fields. Admin can affect it by editing phone, address, or CTA fields on the listing record.

**SEO needs:**
The Quick Action Bar is a Client Component rendered after initial HTML output. It is not included in the server-rendered HTML. It contributes no SEO value. That is acceptable — it is a conversion tool, not an indexing asset.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `action_bar_cta_click` | Primary CTA in Quick Action Bar is clicked | `entity_type`, `entity_id`, `cta_type`, `cta_label`, `scroll_depth_pct` at time of click |
| `action_bar_phone_click` | Phone icon in Quick Action Bar is tapped | `entity_type`, `entity_id` |
| `action_bar_map_click` | Map icon in Quick Action Bar is tapped | `entity_type`, `entity_id` |
| `action_bar_save_toggled` | Save button in Quick Action Bar is clicked | `entity_type`, `entity_id`, `action` (`saved` or `unsaved`) |

**Design notes:**
Bar height: 56px (desktop), 52px (mobile). Background: Deep Background (`#19191E`) with a 1px bottom border in Charcoal at 30% opacity — this separates the bar from the page content below it. The bar appears with a subtle fade-in (150ms ease-out opacity transition) when it first enters sticky state. It does not "slide down" — it fades in. The entity name and quick-tap icons use Pale Lavender or Cream on the Dark Background. The Amber Gold CTA button is the single chromatic accent in the bar.

**Mobile behavior:**
At 375px: the bar collapses to three elements: entity name (truncated to 18 characters), primary CTA (Amber Gold, `flex-1` width), and a combined Save+Share icon group. Phone and map quick-tap icons are removed from the mobile bar — those contacts are accessible in Section 3 (At-a-Glance) which is a full-width contact summary just below the hero. This keeps the mobile bar uncluttered and thumb-reachable. The bar itself uses `position: sticky` on mobile to avoid z-index conflicts with mobile browser chrome. Bar is 52px minimum height — sufficient thumb zone size. CTA button minimum height: 44px within the 52px bar.

---

### Section 3: At-a-Glance

**Purpose:**
The At-a-Glance section answers "the fast five" questions a visitor has before they will take action: What kind of entity is this? Where are they? Are they open right now? How do I contact them? When does this happen or close? This section is not designed to be read carefully — it is designed to be scanned in under 10 seconds. It is the operational summary of the entity. For a business, it is the replacement for the Google sidebar. For an event, it is the logistics strip. For a job, it is the role + deadline summary.

**Applies to:** Business, Professional, Creative, Event, Job, Vendor, Product, Service

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Category (primary) | Badge | All | Yes | Amber Gold badge; links to category discovery page |
| Subcategories | Badges | Business, Professional, Creative, Vendor | No | Pale Lavender badges; up to 3 subcategory tags |
| City | Text + location icon | Business, Professional, Creative, Event, Vendor | Yes for local entities | Lato Regular; links to city landing page |
| Hours of operation | Hours block | Business, Professional, Creative, Vendor | No | Shows current open/closed status + full weekly schedule |
| Open/Closed indicator | Status badge | Business, Professional, Creative, Vendor | Conditional on hours field | Green "Open now" / Red "Closed · Opens [day] at [time]"; calculated client-side |
| Phone | `tel:` link | Business, Professional, Creative, Vendor | No | Phone handset icon + formatted number |
| Email | `mailto:` link | Business, Professional, Creative, Vendor | No | Email icon + address |
| Website | External link | Business, Professional, Creative, Vendor | No | Globe icon + domain (not full URL displayed); opens new tab |
| Address | Text + map link | Business, Professional, Creative, Event | No | Map pin icon; tapping opens maps app; service-area businesses show "Service area: [City]" |
| Event date + time | Date/time display | Event | Yes for Event | Format: "Saturday, June 14, 2025 · 7:00 PM – 10:00 PM EDT" |
| Event location | Text + optional map link | Event | Yes for Event | Physical address or "Virtual" with platform link |
| Job location | Text | Job | Yes for Job | City name + state, or "Remote", or "Hybrid – [City]" |
| Application deadline | Date display | Job | No | Format: "Apply by June 30, 2025"; red text if within 7 days |
| Job type | Badge | Job | No | Full-time / Part-time / Contract / Internship / Volunteer |
| Salary range | Text | Job | No | Format: "$60K – $80K / year" or "Competitive" |
| Product price | Text | Product | Yes for Product | Amber Gold text; format: "$XX.XX" or "From $XX.XX" |
| Product variants | Select or badge row | Product | Conditional | Size, color, or type selector if variants exist |
| Service price | Text | Service | No | Format: "From $XX" or "$XX / hour" or "Contact for pricing" |
| Service duration | Text | Service | No | Format: "60 min" or "Half-day" |
| Social links | Icon row | Business, Professional, Creative, Vendor | No | Instagram, Facebook, LinkedIn, TikTok, YouTube icons; only icons with non-empty URLs rendered |

**MVP behavior:**
Available for Business only. The section renders as a two-column card on desktop (contact info left, hours right) and a stacked single-column list on mobile. Fields rendered at MVP: category badge, city text, open/closed indicator + full hours, phone `tel:` link, email `mailto:` link, website external link, address + map link, social links icon row.

**Later behavior:**
- Beta: At-a-Glance available for Professional, Creative, Event, Job. Event variant shows date/time and event location. Job variant shows location, deadline, job type, and salary range.
- V1: Subcategory badges added for all applicable entity types. Verification date shown in a tooltip on the Verified trust badge.
- V2: Product variant selector embedded within At-a-Glance for Product sub-pages.

**Empty state:**
Fields that have no data are hidden individually — there is no row showing "Phone: Not provided." The section renders only populated fields. If all contact fields are empty (only possible for Unclaimed listings with minimal seed data), the At-a-Glance section shows only: category badge and city — it does not hide entirely. Below the minimal data, a "Know more about this business? Help us keep it accurate →" link (routes to the community corrections flow, Beta/V1).

**Editability by owner:**
All fields in this section are editable in the dashboard Page Editor under the "Location + Hours" and "Contact" sub-sections. Hours are set per day with individual open/closed toggles and time pickers. Address has a "service area" toggle that replaces the address fields with a service area description text input.

**Admin moderation needs:**
- Override any contact field directly from the admin listing editor.
- Flag a listing as having incorrect address or hours (from a community correction report).
- View a timestamp of when each contact field was last edited, and by whom (owner vs admin).

**SEO needs:**
Phone, address, hours, and website are included verbatim in the `LocalBusiness` JSON-LD structured data block (for Business entity type). For Event: `Event` JSON-LD schema uses the event date, location, and description fields. For Job: `JobPosting` JSON-LD schema uses title, description, salary, location, and deadline fields. These structured data blocks are rendered in `<script type="application/ld+json">` in the `<head>` via Next.js `generateMetadata` or a `<Head>` component.

The hours block is rendered as visible HTML text — not hidden behind a JavaScript-only component — so that Google can index current hours. The open/closed indicator is the only purely client-rendered element (time zone comparison). The hours schedule itself is server-rendered.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `phone_click` | Phone `tel:` link tapped | `entity_type`, `entity_id`, `source` (`at_a_glance`) |
| `website_click` | Website link clicked | `entity_type`, `entity_id` |
| `map_click` | Address map link tapped | `entity_type`, `entity_id` |
| `email_click` | Email `mailto:` link tapped | `entity_type`, `entity_id` |
| `social_link_click` | Social icon link clicked | `entity_type`, `entity_id`, `platform` (e.g., `instagram`) |
| `job_deadline_view` | Job page with deadline within 7 days is loaded | `entity_id`, `days_remaining` |

**Design notes:**
At-a-Glance renders in a card with a Cream background and a 1px Charcoal/15% border. Category badge is Amber Gold with Brand Black text. Subcategory badges are Pale Lavender with Charcoal text. The open/closed indicator is a small dot (8px) + text: green (`#22C55E`) for open, red (`#EF4444`) for closed — with the next open time in Charcoal below the status for closed entities. Font for all data rows: Lato Regular 14px. Labels are Lato Regular 12px Charcoal. The two-column layout on desktop splits: left column = category, hours, open/closed; right column = phone, email, website, address, social links. On mobile, all rows stack in a single column in that same order.

**Mobile behavior:**
At 375px: all fields stack in a single column. Each row is minimum 44px height (the icon + text row). The hours schedule is collapsed by default behind a "See hours" expand toggle (chevron); tapping it expands the full weekly schedule. The social links icon row wraps to a second row if more than 5 platforms exist. All `tel:` and `mailto:` links use native mobile behavior. The map link opens the native maps app via deep link.

---

### Section 4: Story

**Purpose:**
The Story section is the human layer of the Page. It moves a visitor from "what is this entity?" to "why does this entity exist and why should I care?" For a business, it is the founder story, mission, and values. For a professional, it is the bio and professional narrative. For a creative, it is the artistic voice and process. For a vendor, it is the brand origin. The Story section is what makes a BLACQList Page feel like something a Google Business Profile never will: a real person made this, with intention, for a reason. Without this section, a Page is a listing. With it, a Page is a presence.

**Applies to:** Business, Professional, Creative, Vendor, Product (as product description), Service

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| About / description | Long-form text | Business, Professional, Creative, Vendor, Service | Required for Business (min 50 chars for publish) | Plain text at MVP; rich text (bold, italics, links) at V1; max 1000 chars at MVP |
| Origin story | Text | Business | No | "How we started" — free text, up to 500 chars; separate from description |
| Values statement | Text | Business, Professional | No | Short list or paragraph; up to 300 chars |
| Bio | Text | Professional, Creative | Required for Professional/Creative Page types | Up to 500 chars; separate field from business description |
| Product description | Text | Product | Yes for Product | Up to 600 chars; plain text at MVP |
| Service description | Text | Service | Yes for Service | Up to 400 chars |
| "Read more" truncation | UI behavior | All | System-applied | Truncate at 4 visible lines; "Read more" expands; "Show less" collapses |

**MVP behavior:**
Available for Business only. The section renders the business description as the primary body text. If an origin story is provided, it renders in a visually distinct block below the description (slightly smaller font, with a subtle left border in Amber Gold). Values statement, if provided, renders below the origin story as a short italicized paragraph or bullet list. The section heading "About" renders as an `<h2>`. All text is server-rendered. The "Read more" toggle is a Client Component.

**Later behavior:**
- Beta: Story available for Professional (bio field) and Creative (bio field + "about my practice" field). Rich text formatting (bold, italic, external links) added for V1 for all entity types.
- V1: Structured values statement for Business: an owner can add up to 3 short "values" as labeled chips (e.g., "Minority-owned", "Women-led", "Veteran-owned") that render as Pale Lavender badges below the description.
- V2: Vendor's Story section includes a "brand origin" narrative with an optional founder photo (portrait format, circular crop) displayed alongside the text.

**Empty state:**
If description is empty (possible for Unclaimed listings): the Story section is hidden on the public Page. No "Add a description" prompt is shown publicly. The section is only hidden — it does not leave a visual gap — because the section ordering ensures the At-a-Glance section immediately precedes What They Offer and the page flows naturally without it.

For an Unclaimed listing where no description exists, admins may add a brief placeholder description during seeding ("Black-owned [category] in [city]. Claim this listing to update your story."). This placeholder is hidden once an owner claims and edits the page.

**Editability by owner:**
- Description: editable in dashboard Page Editor > About section. Required field for publishing. Character counter shown. Plain text only at MVP.
- Origin story: optional field, same section.
- Values statement: optional field, same section. V1 adds the structured values chips.
- Bio (Professional/Creative, Beta): editable in the equivalent "About" section of the professional/creative editor.

**Admin moderation needs:**
- Review and edit any text field for content policy compliance (hate speech, false claims, spam).
- Replace placeholder description with a higher-quality admin-authored description for high-priority seed listings.
- Flag a description as needing owner review (triggers a notification to the owner if claimed).

**SEO needs:**
The description is the primary body text for the Page and is the source for the `<meta name="description">` tag (truncated to 160 characters). It is fully included in the server-rendered HTML for Google indexing. The `<h2>` heading for this section ("About [Entity Name]") contains a keyword-rich heading that reinforces the LocalBusiness structured data. For Professional/Creative Pages (Beta), the bio text is included in the server-rendered HTML and contributes to long-tail keyword indexing ("Atlanta-based graphic designer specializing in...").

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `story_expanded` | "Read more" toggle clicked to expand | `entity_type`, `entity_id` |
| `story_collapsed` | "Show less" toggle clicked to collapse | `entity_type`, `entity_id` |

**Design notes:**
Section heading: "About" (Business/Vendor), "Bio" (Professional/Creative) — Lato Medium 12px uppercase letter-spaced Charcoal label above the section heading. The `<h2>` heading is visually rendered as 20px Glacial Indifference. Body text: Quicksand Regular 16px, `leading-7`. The origin story block has a 3px left border in Amber Gold and `pl-4` padding — this differentiates it from the description without requiring a separate heading. On desktop, the Story section spans the main content column (up to 720px max-width). It does not use a two-column layout — text benefits from full column width for reading comfort.

**Mobile behavior:**
At 375px: the section renders full-width, single column. Font size: 15px Quicksand Regular. Line height: 1.65. The "Read more" toggle uses a minimum tap target of 44px height with the "Read more" text plus a chevron icon. The collapsed height is 4 lines × line-height ≈ approximately 100px. All text is selectable and copyable (standard mobile behavior — no overrides).

---

### Section 5: What They Offer

**Purpose:**
What They Offer is the operational depth of the Page — it answers "what can I actually get from this entity?" across all entity types. For a business, it is the services list. For a professional, it is the services with pricing. For a creative, it is the portfolio samples and commission types. For an event, it is the full event description, schedule, and featured elements. For a job, it is the full job description and requirements. For a vendor, it is the product grid teaser. This section converts a visitor who already trusts the entity into a visitor who is ready to act.

**Applies to:** Business (services), Professional (services), Creative (portfolio/commissions), Event (event details), Job (job description + requirements), Vendor (product grid teaser)

**Fields — Business / Professional:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Service name | Text | Business, Professional | Yes per service | Lato Medium; max 60 chars |
| Service description | Text | Business, Professional | No | Lato Regular; max 200 chars; optional |
| Service price | Text | Business, Professional | No | Free-form text: "$50/hr", "From $200", "Contact for pricing" |
| Services list | List | Business, Professional | No (section optional) | Up to 20 services; drag-to-reorder in dashboard |
| "View all services" expansion | UI control | Business, Professional | System-applied if >6 services | Shows first 6; remainder hidden behind expansion |

**Fields — Creative:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Portfolio items (images) | Image gallery | Creative | No (section optional) | Up to 24 portfolio images; primary display format for creative work |
| Portfolio item caption | Text | Creative | No | Per-image; max 140 chars |
| Commission / booking types | Text list | Creative | No | List of what the creative accepts: "Brand identity", "Editorial portraits", etc. |
| Commission status | Badge | Creative | No | "Open for commissions" (Amber Gold) / "Not currently available" (Charcoal) |

**Fields — Event:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Event description | Long-form text | Event | Yes for Event | Up to 1000 chars; this is the primary body text for Event Pages (no Story section) |
| Event schedule | Text list | Event | No | Individual schedule items with times; e.g., "6:00 PM – Doors open" |
| Featured guests / speakers | Text list | Event | No | Names and titles; links to their BLACQList Pages if they have one |
| Ticket tiers | Text list | Event | No | Tier name + price; links to external ticketing |
| Ticket link | URL | Event | Yes if tickets are required | "Get Tickets" CTA destination |
| RSVP link | URL | Event | Yes if RSVP only | "RSVP" CTA destination |
| Organizer | Linked entity | Event | No | Link to organizer's Business or Professional Page |
| Accessibility info | Text | Event | No | "Wheelchair accessible", "ASL interpretation available", etc. |

**Fields — Job:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Job description | Long-form text | Job | Yes | Up to 2000 chars; this is the primary body text for Job Pages (no Story section) |
| Responsibilities | Bulleted list | Job | No | Rendered as `<ul>` |
| Requirements | Bulleted list | Job | No | Rendered as `<ul>` |
| Nice-to-have qualifications | Bulleted list | Job | No | Rendered as `<ul>` |
| How to apply | Text | Job | No | Instructions beyond the CTA link |
| Employer link | Linked entity | Job | No | Link to employer's Business or Professional Page |

**Fields — Vendor (product grid teaser):**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Featured product cards | Grid (2–4 cards) | Vendor | Conditional | Shows 2–4 featured products; each links to a Product sub-page |
| Product card: name | Text | Vendor | Yes per card | |
| Product card: price | Text | Vendor | Yes per card | Amber Gold text |
| Product card: image | Image | Vendor | No | Falls back to vendor cover image or placeholder |
| "View all products" link | Link | Vendor | Yes if products exist | Routes to vendor product catalog sub-route |

**MVP behavior:**
Available for Business only. The section renders the services list — up to 20 items. Each item shows: service name (Lato Medium), optional description in smaller text, optional price in Amber Gold text. If more than 6 services exist, the first 6 are shown and a "Show all [N] services" button expands the rest. If no services have been added, the section is hidden on the public Page.

**Later behavior:**
- Beta: What They Offer available for Professional (services + pricing), Creative (portfolio gallery + commission types), Event (full event description + schedule), Job (full job description + requirements lists).
- V1: Services for Business and Professional gain named pricing tiers ("Starting at", "Hourly rate", "Project rate") with structured pricing fields rather than free-form text. Vendor product grid teaser added in V1 for early vendor participants.
- V2: Full Vendor product grid with pagination, filtering by product category, and cart integration.

**Empty state:**
If no services or offerings have been added: the section is hidden on the public Page. No "Add your services" prompt is shown publicly. The prompt lives in the owner dashboard completion checklist.

**Editability by owner:**
- Services (Business/Professional): editable via dashboard > Services Manager. Add, edit, delete, reorder.
- Creative portfolio: image upload via dashboard > Portfolio section (Beta).
- Event details: editable in the event listing editor (Beta).
- Job description: editable in the job listing editor (Beta).

**Admin moderation needs:**
- Remove a service listing that violates content policy.
- Edit job description for formatting quality on high-priority seed job postings.
- Flag a service with an inappropriate or misleading price claim.

**SEO needs:**
Service names and descriptions are server-rendered as visible text and contribute to long-tail keyword indexing ("natural hair care Atlanta", "wedding photography Chicago"). For Event Pages, the event description is included in `Event` JSON-LD `description` field. For Job Pages, the full job description is used in `JobPosting` JSON-LD `description`. The service list renders as an `<ul>` with semantic markup. Section `<h2>` reads: "Services" (Business), "What I Offer" (Professional), "My Work" or "Portfolio" (Creative), "About This Event" (Event), "Job Description" (Job).

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `services_expanded` | "Show all services" button clicked | `entity_type`, `entity_id`, `total_service_count` |
| `commission_status_view` | Creative page with commission status badge loaded | `entity_id`, `commission_status` |
| `ticket_link_click` | Ticket or RSVP link clicked on Event page | `entity_id`, `ticket_tier` |
| `apply_link_click` | Apply link clicked on Job page | `entity_id` |
| `vendor_product_card_click` | Product card in vendor teaser grid clicked | `entity_id` (vendor), `product_id` |

**Design notes:**
Service list items: each row has a 1px Pale Lavender bottom border. Service name: Lato Medium 15px Brand Black. Description: Lato Regular 13px Charcoal. Price: Lato Medium 14px Amber Gold, right-aligned. The expand control ("Show all N services →") uses a text link in Amber Gold with a downward chevron. Creative portfolio grid: 3 columns desktop, 2 columns mobile, with each image in a 1:1 square crop. Commission status badge: "Open for commissions" in a rounded badge with Amber Gold background and Brand Black text; "Not currently available" in Pale Lavender and Charcoal.

**Mobile behavior:**
At 375px: service list items are full-width, single column. Price right-aligns within the same row as the service name (flex-row with space-between). For creative portfolio: 2-column grid on mobile. Portfolio images are square-cropped at 150px × 150px minimum. For event schedule: each schedule item is a full-width row with time left-aligned and description right-aligned. The "Show all services" expansion works via a `<details>/<summary>` element or a Client Component toggle — either is acceptable; the server-rendered default shows the first 6.

---

### Section 6: Media

**Purpose:**
The Media section is the visual proof layer. It answers "what does this entity actually look like?" beyond the hero cover image. For a business, it is the gallery — the storefront, the team, the product in context, the atmosphere. For a professional or creative, it is the portfolio. For an event, it is the event photography from previous editions or a preview of what to expect. The Media section distinguishes Pages that have claimed owners actively investing in their presence from seed listings. It is also a signal to visitors: a Page with a full, beautiful gallery belongs to someone who cares.

**Applies to:** Business (gallery), Professional (portfolio), Creative (portfolio — primary), Event (event photos), Vendor (product images)

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Gallery images | Image array | Business, Vendor | No | Up to 12 images; JPEG, PNG, WebP; max 2MB each; served via CDN |
| Portfolio images | Image array | Professional, Creative | No | Up to 24 images for Creative; up to 12 for Professional |
| Image caption | Text | All | No | Per-image; max 140 chars; rendered in lightbox only |
| Event photos | Image array | Event | No | Up to 12 images from past events or promotional images |
| Product images | Image array | Product | No | Up to 8 images; first image is the primary product thumbnail |
| Lightbox navigation | UI behavior | All | System-applied | Left/right navigation; swipe on mobile; Escape closes |
| Gallery sort order | Integer per image | All | System-applied | Owner-draggable in dashboard; persists `sort_order` field |

**MVP behavior:**
Available for Business only. Gallery renders as a responsive uniform grid: 3 columns desktop, 2 columns tablet, 2 columns mobile. Each cell is a square-cropped image thumbnail. Clicking a thumbnail opens a lightbox with the full-size image, caption (if provided), and left/right navigation. Lightbox on desktop: centered modal with dark overlay. Lightbox on mobile: full-screen with swipe navigation. If fewer than 3 images exist, the gallery renders as a narrower single-row of image thumbnails (no grid). If zero images exist, the section is hidden entirely. No "Add photos" prompt is shown on the public Page.

**Later behavior:**
- Beta: Media available for Professional (portfolio grid), Creative (portfolio as the primary feature, occupying the largest visual space on the page), Event (event photo gallery).
- V1: Video embeds added — owner can provide YouTube or Vimeo URLs; these render as embedded players within the gallery in a mixed grid of images and video thumbnails. Maximum 3 video embeds per Page at V1.
- V2: Product images for Product sub-pages support a dedicated carousel at the top of the product Page (separate from the hero treatment).

**Empty state:**
If no images have been uploaded: the section is hidden. Not hidden behind a conditional that might cause layout jitter — the section is simply excluded from the render order. On the dashboard Page Editor, an "Add photos" prompt appears with an image count indicator (0 / 12 photos). This prompt is not visible on the public Page.

**Editability by owner:**
Images are uploaded in dashboard > Page Editor > Gallery section. Owner can: upload (multi-select file or camera capture on mobile), reorder (drag-to-reorder grid), delete (with undo toast — image is marked deleted but not permanently removed for 24h), and add or edit captions per image. Gallery images are stored in Supabase Storage. Paths stored in the `media_attachments` table; signed CDN URLs generated at read time.

**Admin moderation needs:**
- Remove any image from a gallery (for content policy violations: nudity, violence, unrelated content, competitor branding).
- View the full image for moderation purposes directly in the admin listing detail view.
- Bulk-remove all images from a listing if it is flagged for fraudulent content.

**SEO needs:**
Gallery images are rendered as `<img>` elements with `alt="[Entity Name] — [caption if provided, otherwise: image N of M]"`. The first three gallery images are included in `og:image` carousel metadata where supported (some social platforms render multiple OG images). The gallery section heading "Photos" or "Portfolio" is an `<h2>`. Images are lazy-loaded below the fold with `loading="lazy"` and explicit width/height attributes to prevent layout shift (CLS impact).

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `gallery_opened` | Any gallery image thumbnail clicked | `entity_type`, `entity_id`, `image_index` |
| `gallery_navigated` | Left/right navigation in lightbox used | `entity_type`, `entity_id`, `direction`, `image_index` |
| `gallery_closed` | Lightbox closed via Escape or overlay click | `entity_type`, `entity_id`, `last_image_index` |
| `video_embed_played` | Video embed play button pressed | `entity_type`, `entity_id`, `video_url` |

**Design notes:**
Gallery grid: `gap-2` between images. Each thumbnail is square-cropped (`aspect-square`, `object-cover`). On hover (desktop), a subtle overlay with a zoom/expand icon (white, centered) appears over the image thumbnail. The lightbox overlay is Brand Black at 85% opacity. The lightbox image is centered with max 90% viewport width/height. Caption text in lightbox: Lato Regular 14px white, centered below the image. The image count indicator in the lightbox: "3 / 8" in Lato Regular 12px Charcoal, top-right corner.

For Creative Pages (Beta), the portfolio grid occupies the full main content column width — it is the primary visual section of the Page, rendered above the services/commissions section. Creative portfolio images support a larger display size (4-column grid on desktop, 2-column on mobile) to showcase work quality.

**Mobile behavior:**
At 375px: gallery grid is 2 columns. Each thumbnail is square-cropped at (viewport width - padding - gap) / 2 ≈ 175px per side. Lightbox on mobile: full-screen, images fit within the viewport with object-fit contain. Swipe left/right navigates between images. A close button (X, 44×44px, top-right) closes the lightbox. Captions appear at the bottom of the screen in a semi-transparent strip. The drag-to-reorder in the dashboard uses touch-friendly drag handles — standard browser drag is not used on mobile (requires pointer events compatible library, e.g., `@dnd-kit/core`).

---

### Section 7: Trust

**Purpose:**
The Trust section is the credibility layer. It makes the entity's trust status explicit — not just as a small badge in the hero, but as a dedicated section that explains what the trust level means and how it was earned. For visitors who are unfamiliar with The BLACQList, this section answers: "Is this entity legitimate? Has anyone verified this is real?" For claimed and verified entities, this section is a conversion asset. For unclaimed entities, it is an acquisition hook — it tells the visitor (and implicitly, the owner if they encounter their own Page) that a higher trust level is available and worthwhile.

**Applies to:** Business, Professional, Creative, Vendor

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Trust badge (detailed) | Badge + label | Business, Professional, Creative, Vendor | Yes (system-assigned) | Full display of trust tier: icon + tier name + short description of what it means |
| Trust tier description | Text | All trust tiers | System-generated | Short copy: "Unclaimed: this listing was created from public data" / "Claimed: this business has verified ownership" / "Verified: identity and business status confirmed" / "Certified: meets BLACQList excellence criteria" |
| Claim prompt | CTA block | Unclaimed only | Conditional (Unclaimed only) | "Is this your business? Claim your free BLACQList Page →" — visible to all visitors on Unclaimed pages; routes to `/claim/[listing-id]` |
| Verification date | Text | Verified, Certified (V1) | System-generated | "Verified [Month Year]" |
| Reviews summary | Star rating + count | Business, Professional, Creative, Vendor | V1 | Average star rating (1–5) with count; links down to Section 8; displayed only after moderation opens |
| Certification criteria summary | Text | BLACQList Certified (V1) | System-generated | 2–3 sentence explanation of what BLACQList Certified means |

**MVP behavior:**
The section renders the current trust badge at its full, expanded size (not the compact hero badge) with the trust tier name and its descriptive copy. For Unclaimed listings, the claim prompt is displayed — a Amber Gold-outlined block with the entity name, the "Is this your business?" copy, and the "Claim Your Free BLACQList Page" Amber Gold button. For Claimed listings, the claim prompt is hidden and replaced with a brief "This page is owner-managed." text. Reviews summary and Certification are not shown at MVP — their placeholder is not rendered (no "coming soon" copy in this section at MVP).

**Later behavior:**
- Beta: No changes to Trust section structure.
- V1: Reviews summary added (average star + count + link to review list in Section 8). Verified and BLACQList Certified tiers activated. Certified Pages show a short criteria summary and the certification date.

**Empty state:**
The Trust section never has an empty state — it always shows the current trust tier. Even a minimally-seeded Unclaimed listing shows the Unclaimed badge and the claim prompt.

**Editability by owner:**
The trust badge and tier are not owner-editable — they are system-assigned. Owners interact with trust through the claim flow (claim → Claimed tier), the verification flow (V1 — upload documentation → admin review → Verified tier), and the certification application flow (V1 — admin-reviewed application). The claim prompt content ("Is this your business?") is system copy — not owner-editable.

**Admin moderation needs:**
- Override trust tier for any listing (e.g., manually upgrading to Verified after reviewing documentation, or downgrading Verified to Claimed if verification expires or is revoked).
- Approve or deny verification applications (V1 queue).
- Remove or suspend a trust badge if fraud is detected.

**SEO needs:**
The trust badge tier name is included as a visible `<span>` with semantic text — "Claimed Business", "Verified Business" — that search engines can index. The `LocalBusiness` JSON-LD block includes a `hasCredential` or custom property for trust tier (non-standard but parseable by Google as additional context). No specific structured data schema maps directly to BLACQList trust tiers, so this is supplementary rich text rather than formal structured data.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `claim_prompt_click` | "Claim Your Page" button in Trust section clicked | `entity_id`, `trust_tier` (`unclaimed`) |
| `trust_section_view` | Trust section scrolled into viewport | `entity_type`, `entity_id`, `trust_tier` |

**Design notes:**
The expanded trust badge in this section is 80px height (vs. 24px in the hero). It renders as a horizontal lockup: large icon left (badge, checkmark, star depending on tier), tier name in Glacial Indifference 20px right of the icon, tier description in Lato Regular 14px Charcoal below the name. Color treatment: Unclaimed = Pale Lavender icon, Charcoal text. Claimed = Amber Gold icon, Brand Black text. Verified = Gold gradient icon, Brand Black text. Certified = Amber Gold star icon + gradient fill, Brand Black text.

The claim prompt block for Unclaimed listings: Amber Gold 1px border, Cream background, `rounded-lg`, `p-4`. Copy: "[Entity name] has not yet claimed this page. If you own this business, take control and add your story, photos, and services for free." Below the copy: Amber Gold "Claim This Page →" button + "Learn more about BLACQList Pages" text link.

**Mobile behavior:**
At 375px: the trust badge lockup stacks vertically — icon above, text below. The claim prompt block is full-width with the CTA button below the copy text at full width. Minimum tap target for the CTA: 48px height, full-width button.

---

### Section 8: Community Connection

**Purpose:**
The Community Connection section is where the platform's communal character becomes tangible on the Page. This section holds the reviews, the community corrections prompt, and the "Support this business" nudge. It is the section that transforms a Page from a static micro-website into a living piece of community infrastructure. At MVP, this section contains only the "Support this business" save nudge and a placeholder for what is coming. At Beta, the community corrections prompt activates. At V1, reviews appear. The section grows in density and value with each phase.

**Applies to:** Business, Professional, Creative, Vendor

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| "Support this business" nudge | CTA block | Business, Professional, Creative, Vendor | Yes | Save prompt for anonymous visitors; "Saved [N] times" social proof count; visible to all |
| Save count | Number | All applicable | Yes | Public social proof; "This listing has been saved [N] times by our community" |
| Community corrections prompt | Link | Beta+ | Beta and later | "Know something that's not right about this page? Help us keep it accurate." links to correction form |
| Reviews: star average | Number display | V1 | V1 for Business, Professional, Creative, Vendor | Average rating from 1–5; displayed only when at least 3 approved reviews exist |
| Reviews: count | Number | V1 | V1 | "N reviews" |
| Reviews: individual review list | Review card list | V1 | V1 | Up to 10 shown; "View all" link to full paginated review page |
| Review card: reviewer name | Text | V1 | Yes per review | Display name from user account |
| Review card: star rating | 1–5 star display | V1 | Yes per review | |
| Review card: body text | Text | V1 | No per review | Up to 500 chars |
| Review card: date | Date | V1 | Yes per review | "March 2025" format |
| Owner response to review | Text | V1 | No | Indented below the review; "Response from [Business Name]:" label |
| Review submission CTA | Button | V1 | V1 | "Write a review" — authenticated users only; routes to review form |
| "Helpful" vote on review | Button | V2 | V2 | Up/down vote count on individual review cards |

**MVP behavior:**
The section contains only the "Support this business" block: "This listing has been saved [N] times by our community. Add it to yours →" with a Save button (same behavior as hero and quick action bar: auth-gated for anonymous users). The [N] count is a live count from the `saves` table. No community corrections prompt. No reviews section. No placeholder for reviews. The section heading at MVP is simply "Support" or the content is rendered without a prominent `<h2>` heading — it is a subtle nudge, not a featured section at MVP.

**Later behavior:**
- Beta: Community corrections prompt added: "Know something that's not right about this page?" with a "Suggest a correction" link. Clicking opens a form (modal or page) where the visitor can submit a field name + suggested value. Admin reviews corrections in the admin corrections queue.
- V1: Full reviews section replaces the placeholder entirely. Reviews display is gated on: (a) at least 3 approved reviews and (b) the listing being in Claimed status or higher. If the listing has fewer than 3 approved reviews, no reviews are shown — no "0 reviews" state is exposed publicly. When reviews display: star average at the top, individual review cards below (most recent first), "Write a review" button for authenticated users, owner response capability for page owners.

**Empty state:**
Save count of 0: the nudge text changes to "Be the first to save this listing." with the Save button. Save count > 0: shows the count. Reviews (V1): the reviews section only renders when at least 3 approved reviews exist — no "no reviews yet" state is shown publicly. The absence of the reviews section is the silent empty state.

**Editability by owner:**
- Owner cannot edit save counts (system data).
- Owner can respond to individual reviews (V1) via the dashboard > Reviews section.
- Owner can flag a review for admin review (V1) but cannot delete reviews.
- Community corrections prompt is system copy — not owner-editable.

**Admin moderation needs:**
- Review and approve or reject submitted corrections (Beta correction queue).
- Review, approve, or reject submitted reviews before they are displayed (V1 review moderation queue).
- Remove an approved review if it violates content policy post-approval.
- Review owner responses to reviews for content policy compliance (V1).

**SEO needs:**
When reviews are displayed (V1), individual review text is server-rendered and contributes to long-tail keyword indexing. Review structured data uses `Review` and `AggregateRating` JSON-LD nested within the `LocalBusiness` block. The `ratingValue`, `reviewCount`, and individual `Review` items are included in the structured data only when there are 3+ approved reviews. The save count is not included in structured data (it is a platform-internal metric, not a standard review signal).

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `community_save_nudge_click` | Save button in Community Connection section clicked | `entity_type`, `entity_id`, `action` (`saved` or `auth_gated`) |
| `correction_prompt_click` | "Suggest a correction" link clicked | `entity_type`, `entity_id` |
| `review_form_opened` | "Write a review" button clicked | `entity_type`, `entity_id` |
| `review_helpful_voted` | Helpful vote button on a review clicked (V2) | `entity_id`, `review_id`, `vote_direction` |
| `owner_response_viewed` | Owner response expanded/visible | `entity_id`, `review_id` |

**Design notes:**
At MVP, the "Support this business" block is a small, contained card at the bottom of the Page's main content column — not a featured section. Cream background, Charcoal border, `rounded-md`, `p-4`. The save count text is Lato Regular 14px Charcoal. The Save button is compact (secondary/outline variant). This section should feel like a gentle community nudge, not a conversion push — that role belongs to the hero and quick action bar.

When reviews activate (V1), the section becomes a primary page section with an `<h2>` heading, the star aggregate display in a prominent lockup, and review cards in a stacked list. Review cards use Cream background with a Charcoal/15% border. Reviewer name: Lato Medium. Body text: Lato Regular 14px. Date: Lato Regular 12px Charcoal. Owner response: indented 16px, Pale Lavender left border 3px, "Response from [Business Name]" label in Lato Medium 12px Amber Gold.

**Mobile behavior:**
At 375px: the save nudge block is full-width, with count text above the button. At V1, the reviews star aggregate is full-width. Review cards are full-width. The "Write a review" button is full-width below the aggregate rating. Individual review cards stack vertically. Star ratings use 20px SVG stars (minimum 44px tap target for interactive rating inputs).

---

### Section 9: Platform Activity

**Purpose:**
Platform Activity makes community engagement visible on the Page — it is public social proof of the entity's standing within The BLACQList ecosystem. The save count signals popularity. The view count is a private metric available only to the entity owner in their dashboard (it is not public-facing to prevent gaming). Editorial collection appearances (V1) tell visitors "this entity was curated" and provide a path to discover related listings. This section bridges the gap between the Page as an isolated entity record and the Page as a node in a living community platform.

**Applies to:** Business, Professional, Creative, Event, Job, Vendor (all top-level Pages)

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Save count | Number (public) | All top-level Pages | Yes (always visible) | "Saved [N] times" — public; updates in near-real-time |
| View count | Number (owner-only) | All top-level Pages | Owner dashboard only | Displayed in owner dashboard stats row; NOT visible on the public Page |
| Editorial collection appearances | Linked list | V1 | V1 | "Featured in: [Collection Name]" with collection cover and link; only shown if the entity appears in at least one published collection |

**MVP behavior:**
The save count is the only public element. It renders as a simple text line: "Saved [N] times by the community." The section is subtle — a single line below the Community Connection section or embedded within it. There is no dedicated section header for Platform Activity at MVP; the save count lives in the Community Connection section at MVP and is split into its own dedicated section at V1 when collection appearances are added.

**Later behavior:**
- V1: Editorial collection appearances added. When a Page has been included in at least one published collection, a "Featured in" row renders with up to 3 collection cards (cover image, collection title, listing count) linking to the collection pages. If the entity appears in more than 3 collections, a "View all collections featuring this listing →" text link appears.

**Empty state:**
Save count 0: "Be the first to save this listing." No collection appearances (V1): the collection row is hidden. It does not show "Not featured in any collections." The absence of the row is the empty state.

**Editability by owner:**
Not editable by the owner — all fields are system-generated. Owners can view their full save count, view count, share count, and CTA click count in their owner dashboard.

**Admin moderation needs:**
- Add or remove a listing from a collection (via admin > Collections editor).
- Reset save count (edge case: fraudulent saves from bulk accounts — save count reset requires super admin action and is logged).

**SEO needs:**
The save count is visible HTML text and can be indexed. No special structured data for this section. Collection names that link to the listing Page are included as `<a>` elements with descriptive text content — this creates bidirectional internal linking between the Page and its parent collections, which strengthens both pages' SEO equity.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `collection_link_click` | Editorial collection card or link clicked in Platform Activity section | `entity_type`, `entity_id`, `collection_id`, `collection_slug` |

**Design notes:**
At MVP, Platform Activity is not a visually distinct section — the save count is a small text element at the bottom of the Community Connection block. At V1, when collection appearances activate, Platform Activity becomes a light horizontal scroll row of collection cards (on mobile) or a 3-column grid row (on desktop). Collection cards: 120px × 80px cover image, collection title in Lato Medium 13px, count in Lato Regular 12px Charcoal. The "Featured in" label above the row is Lato Regular 11px uppercase letter-spaced Charcoal.

**Mobile behavior:**
At 375px: save count is a single line, full-width. Collection appearances (V1) are a horizontal scroll row with cards at 130px × 90px. Scroll snaps to each card. No pagination button — scroll naturally.

---

### Section 10: Related Discovery

**Purpose:**
Related Discovery is the retention mechanism — it catches visitors who are still in research mode and provides a direct path to the next relevant Page without returning to search. It prevents the dead end: "I'm not sure this is quite right, but I don't know where to go next." For businesses, it surfaces similar listings in the same city and category. For events, it shows more events from the same organizer. For jobs, it shows more jobs from the same employer. For products, it shows related products in the vendor's catalog. This section has a dual purpose: it serves the visitor's discovery journey and it deepens their session on the platform.

**Applies to:** All entity types including Product and Service sub-pages

**Fields:**

| Field | Type | Entity Types | Required | Notes |
|---|---|---|---|---|
| Related listings cards | Card row | Business, Professional, Creative, Vendor | Yes if 3+ similar entities exist | 3–4 listing cards; same city + category; excludes current entity |
| Related events from organizer | Card row | Event | Yes if organizer has 2+ events | "More from [Organizer Name]" — links to other event Pages by the same organizer |
| More jobs from employer | Card row | Job | Yes if employer has 2+ active jobs | "More from [Employer Name]" — links to other job Pages from the same employer |
| Related products from vendor | Card row | Product | Yes if vendor has 3+ products | "More from [Vendor Name]" — links to sibling Product sub-pages |
| Service-level cross-links | List | Service | Conditional | "Other services from [Business Name]" — links to sibling service sub-pages |
| Section heading | Text | All | System-generated | "More [Category] in [City]", "More from [Organizer]", "More from [Employer]", "More from [Vendor]" |
| Listing card: cover image | Image | All | No (placeholder if absent) | |
| Listing card: entity name | Text | All | Yes | |
| Listing card: category badge | Badge | Business, Professional, Creative | Yes | |
| Listing card: city | Text | Business, Professional, Creative | Yes | |
| Listing card: trust badge (small) | Badge | Business, Professional, Creative, Vendor | Yes | Compact trust badge |
| Listing card: save button | Icon | Business, Professional, Creative, Vendor | Yes | Same auth-gate behavior as hero save button |

**MVP behavior:**
Available for Business only. Renders 3–4 listing cards in a horizontal row on desktop. Each card is the same `ListingCard` component used in search results and discovery pages. Cards are fetched by querying for published listings matching the current listing's city + primary category, excluding the current listing, ranked by save count descending. If fewer than 3 similar listings exist in the same city + category, the section is hidden.

**Later behavior:**
- Beta: Related Discovery available for Professional, Creative, Event (organizer's other events), Job (employer's other jobs).
- V1: The ranking algorithm for related listings incorporates: editorial curation weight, trust tier (Verified listings appear before Unclaimed), and save count. The section heading may be dynamically replaced with an editorial collection name if the current entity belongs to a collection that includes related entities.
- V2: Related products from vendor for Product sub-pages.

**Empty state:**
If fewer than 3 matching related entities exist: section is hidden entirely. It does not show "No similar listings found." The absence of the section is the empty state.

**Editability by owner:**
Not directly editable by the owner. The related listings are algorithmically selected. There is no "exclude this competitor" option for owners.

**Admin moderation needs:**
- Exclude a specific listing from appearing in any related discovery sections (e.g., if a listing has been flagged but not yet taken down, preventing it from surfacing in related rows).
- Override related discovery to pin a specific collection or set of listings for a high-priority Page.

**SEO needs:**
Related listing cards are rendered as `<a>` elements with descriptive `aria-label` and text content — these are internal links that contribute to site link equity and crawl depth. The section uses `<nav aria-label="Related listings">` wrapper for semantic structure. Each card `href` is the full canonical path of the related listing. Internal linking between related Pages strengthens the overall domain SEO equity for the city + category cluster.

**Analytics events:**

| Event name | Trigger | Properties |
|---|---|---|
| `related_card_click` | Any card in Related Discovery section clicked | `source_entity_type`, `source_entity_id`, `destination_entity_id`, `destination_entity_type`, `card_position` (1–4) |
| `related_save_toggled` | Save button on a related discovery card clicked | `source_entity_id`, `destination_entity_id`, `action` |

**Design notes:**
On desktop: 3–4 cards in a horizontal grid row. Each card: 240px min-width, aspect ratio image 16:9 or 1:1 consistent with search results card format. On mobile: horizontal scroll container with `scroll-snap-type: x mandatory` and each card snapping to position. Card width on mobile: 75vw (≈280px at 375px viewport), so the next card is partially visible indicating scrollability. Section heading: Lato Medium 14px uppercase letter-spaced Charcoal, above the cards. The section renders below the Community Connection or Platform Activity section — it is always the last section before the footer.

**Mobile behavior:**
At 375px: horizontal scroll row, cards at 280px width, 4px gap. The first card is visible and the second card is approximately 30% in view (scroll affordance). The scroll indicator is visual only — no dots or arrows. The save button on each related card is positioned in the top-right corner of the card at 44×44px. Swipe behavior: native horizontal scroll within the row container, independent from the main page vertical scroll.

---

## 4. Section Order by Entity Type

| Order | Business | Professional | Creative | Event | Job | Vendor | Product | Service |
|---|---|---|---|---|---|---|---|---|
| 1 | Hero | Hero | Hero | Hero | Hero | Hero | Hero | Hero |
| 2 | Quick Action Bar | Quick Action Bar | Quick Action Bar | Quick Action Bar | Quick Action Bar | Quick Action Bar | Quick Action Bar | Quick Action Bar |
| 3 | At-a-Glance | At-a-Glance | At-a-Glance | At-a-Glance (date/time/location) | At-a-Glance (location/deadline) | At-a-Glance | At-a-Glance (price/variants) | At-a-Glance (price/duration) |
| 4 | Story | Story | Story | — | — | Story | Story (product desc) | Story |
| 5 | What They Offer (services) | What They Offer (services) | What They Offer (portfolio/commissions) | What They Offer (event details) | What They Offer (job desc) | What They Offer (product grid teaser) | — | — |
| 6 | Media (gallery) | Media (portfolio) | Media (portfolio — primary) | Media (event photos) | — | Media (product images) | Media (product images) | — |
| 7 | Trust | Trust | Trust | — | — | Trust | — | — |
| 8 | Community Connection | Community Connection | Community Connection | — | — | Community Connection | — | — |
| 9 | Platform Activity | Platform Activity | Platform Activity | Platform Activity | Platform Activity | Platform Activity | — | — |
| 10 | Related Discovery | Related Discovery | Related Discovery | Related Discovery | Related Discovery | Related Discovery | Related Discovery | Related Discovery |

**Notes on order:**
- For Event Pages, section 4 (Story) is skipped — the event description is placed in section 5 (What They Offer / event details), which functions as the primary body text. The ordering becomes: Hero → Quick Action Bar → At-a-Glance → What They Offer → Media → Platform Activity → Related Discovery.
- For Job Pages, sections 4 (Story) and 6 (Media) are skipped — the job description is placed in section 5. Trust and Community Connection are also skipped. The ordering becomes: Hero → Quick Action Bar → At-a-Glance → What They Offer → Platform Activity → Related Discovery.
- For Product sub-pages, sections 5 (What They Offer), 7 (Trust), 8 (Community Connection), and 9 (Platform Activity) are skipped. The ordering becomes: Hero → Quick Action Bar → At-a-Glance → Story (product description) → Media (product images) → Related Discovery.
- For Service sub-pages, sections 5 (What They Offer), 6 (Media), 7 (Trust), 8 (Community Connection), and 9 (Platform Activity) are skipped. The ordering becomes: Hero → Quick Action Bar → At-a-Glance (price/duration) → Story (service description) → Related Discovery.
- The Quick Action Bar (Section 2) is implemented as a `position: sticky` / `position: fixed` Client Component that overlays the page — it is not a block-level section in the flow but is listed at position 2 because it activates on hero exit.

---

## 5. Trust Tier Behavior on Pages

### Unclaimed

**Badge appearance:** Pale Lavender background, Charcoal text, outlined shield icon. Text: "Unclaimed".

**Hero trust badge:** Pale Lavender, 24px height, positioned in lower-right of hero.

**Trust section (Section 7):** Rendered with full claim prompt block. The claim prompt is the most prominent element in the section on Unclaimed pages — it is the platform's primary acquisition touchpoint for converting unclaimed listings to owned Pages. Copy: "Is this your business? Claim your free BLACQList Page — add your story, photos, services, and more in under 15 minutes."

**Owner dashboard:** Not accessible. The business owner must complete the claim flow to gain dashboard access.

**Page content:** May have limited data (name, category, city, basic contact info) if the listing was seeded from public sources. Description may be a system placeholder or absent. Gallery will typically be empty.

**What visitors see differently vs. Claimed:** The claim prompt block in Section 7. No "owner-managed" indicator. The Page looks complete if data exists, but the trust badge color communicates that no owner has taken responsibility for its accuracy.

**Admin notes:** Admins can add data to Unclaimed listings directly. Admins see an "Unclaimed" status badge in the listings table. Pending claim requests are associated with Unclaimed listings.

---

### Claimed

**Badge appearance:** Amber Gold background, Brand Black text, checkmark icon. Text: "Claimed".

**Hero trust badge:** Amber Gold, 24px height.

**Trust section (Section 7):** Claim prompt is hidden. Replaced with: "This page is managed by its owner." Amber Gold checkmark icon + text, compact presentation.

**Owner dashboard:** Fully accessible. Page Editor, Services Manager, media upload, CTA configuration, and analytics all available.

**Page content:** Owner has edit control over all fields. Page can have the full complement of sections if the owner has completed them. Completion checklist in the dashboard tracks progress.

**What visitors see differently vs. Unclaimed:** The Amber Gold badge communicates ownership and accountability. The claim prompt is absent. For many visitors, the Claimed badge is sufficient trust signal for basic transactions (visiting a restaurant, browsing a portfolio).

---

### Verified (V1)

**Badge appearance:** Gradient gold-to-amber background, white text, checkmark-in-circle icon. Text: "Verified".

**Hero trust badge:** Gold gradient, 24px height.

**Trust section (Section 7):** Shows: Verified badge (full size), verification date ("Verified March 2025"), and a brief explanation of what Verified means: "This business has confirmed its identity and business status with The BLACQList. Identity documents reviewed."

**What activates Verified:** Owner submits verification documents (business license, EIN verification letter, or government-issued ID matching the business name) via a V1 verification request form. Admin reviews documents in the verification queue. Approval sets `trust_tier = 'verified'` and stamps `verified_at` timestamp.

**Platform behavior changes:** Verified listings appear above Unverified listings in search result ranking at equal save count. Verified listings are eligible for editorial collections. Verified badge appears on listing cards in search results.

---

### BLACQList Certified (V1)

**Badge appearance:** Amber Gold background, Brand Black star icon + "Certified" text. Premium visual treatment.

**Hero trust badge:** Amber Gold with star, 24px height.

**Trust section (Section 7):** Shows: Certified badge (full size, larger than Verified), certification date, and a certification criteria summary: "BLACQList Certified businesses meet our highest standards: verified identity, complete Page, minimum [N] community saves, and consistent positive community feedback."

**What activates Certified:** Admin-reviewed application process (V1). Criteria include: Verified status, complete Page (all 5 completion checklist items), minimum 50 community saves, minimum 5 approved reviews (if reviews are enabled). Criteria are finalized before V1 launch.

**Platform behavior changes:** Certified listings receive the highest ranking weight in search. Certified listings are eligible for homepage featured placement. The Certified badge appears on listing cards prominently in search results. Certified entities are eligible for inclusion in BLACQLight editorial articles.

---

## 6. Tier (Free vs. Premium) Visual Differences on Pages

Monetization tiers are introduced at V1. At MVP, all listings are effectively Free tier. The tier affects the Page's visual capabilities and feature access — not the trust tier.

### Free Tier

- Standard layout across all Page sections.
- Gallery: maximum 6 images (out of the 12-image system capacity).
- Hero: standard hero treatment — static cover image only.
- Services: up to 10 services (out of 20).
- Featured badge: not eligible for Featured placement in search results or homepage.
- Quick Action Bar: standard.
- No "BLACQList Featured" ribbon or badge visible on the Page.

### Standard Tier (V1)

- Full gallery: 12 images.
- Services: up to 20 services.
- Hero: enhanced hero options — wider aspect ratio, logo positioned in the hero (lower-left beside name, instead of above), optional background color tint for entities without a strong cover image.
- Featured placement: eligible for Featured badge in search results (requires admin curation or tier-based sponsored placement).
- Analytics: extended analytics window (90-day) in owner dashboard.
- A subtle "BLACQList Standard" indicator is available in the owner dashboard but is NOT displayed on the public Page — the tier distinction should be invisible to visitors. The quality of the Page is the signal, not a plan badge.

### Premium Tier (V1)

- Everything in Standard.
- Featured badge eligibility: higher priority weighting in search.
- Hero: expanded hero layout option — full-bleed with a larger text lockup and optional animated gradient background (CSS animation, not video).
- A dedicated "Featured" ribbon on the listing card in search results (a small Amber Gold tag in the corner of the card).
- On the Page itself: no visible "Premium" badge on the public page. The visual distinction is in layout quality and featured placement in search, not a label applied to the Page.
- Priority admin support for Page claims and verification.

**Principle:** The public-facing Page does not display pricing tier badges. A visitor should not be able to tell which tier a listing is on from looking at the Page — only the Page's content quality and the presence or absence of the featured ribbon in search results signals that. The tier system is a revenue and capability model, not a status display system.

---

## 7. CTA Configuration

The primary CTA is owner-configured for Business, Professional, Creative, and Vendor Pages. For Event, Job, and Product Pages, the CTA label and action are determined by the entity type. The CTA renders in the hero (Section 1) and the Quick Action Bar (Section 2).

| CTA label | Entity types | Action | URL / destination pattern | Notes |
|---|---|---|---|---|
| Book Appointment | Business, Professional | Opens external URL in new tab | Owner-configured URL (e.g., Calendly, Booksy, custom booking page) | Default for Business Pages with a service focus |
| Order Online | Business, Vendor | Opens external URL in new tab | Owner-configured order URL (e.g., Toast, DoorDash, own e-commerce) | Default for food and product businesses |
| Call Us | Business, Professional, Creative | `tel:` link | Phone number from contact fields (auto-populated if phone exists, or owner re-enters) | Only available if phone exists on the Page |
| Visit Us | Business, Vendor | Opens maps link in new tab | Address from contact fields (auto-generated Google Maps URL from stored address) | Only available if address exists |
| Message Us | Business, Professional, Creative | Opens mailto or external messaging URL in new tab | Owner-configured: email address or link to contact form / social DM |  |
| Visit Portfolio | Professional, Creative | Opens external URL in new tab | Owner-configured portfolio or personal site URL | Specific to Professional/Creative entity types |
| Get Tickets | Event | Opens external URL in new tab | Event ticketing URL (Eventbrite, direct, etc.) | System-fixed label for Event entity type; URL configured in event record |
| RSVP | Event | Opens external URL in new tab | RSVP link (Google Form, Eventbrite free, etc.) | Used when event is free but wants RSVP; mutually exclusive with Get Tickets |
| Apply Now | Job | Opens external URL in new tab | External application URL | System-fixed label for Job entity type |
| Add to Cart | Product | In-platform action | Adds product to cart (V2) | Only available at V2 when marketplace cart is live |
| Buy Now | Product | In-platform action or external URL | At V1: external checkout link. At V2: in-platform checkout | Immediate purchase flow |
| Request Quote | Business, Professional, Service | Opens external URL or in-platform form | Owner-configured quote request form URL | V1; for entities where pricing is bespoke |
| Shop Now | Vendor | Scrolls to / links to product grid section | In-page anchor to What They Offer section or vendor catalog sub-route | Vendor entity type, V2 |

**CTA configuration rules:**
- Exactly one primary CTA is active per Page at any time. Owners configure CTA type and CTA value (URL or auto-populated contact field) in the dashboard.
- The CTA label is the button's visible text. It is the selected option from the list above — owners do not write custom CTA labels (to maintain visual and copy consistency across all Pages).
- The CTA URL is validated server-side: must be a valid URL (for link-based CTAs) or a valid phone number (for Call Us). An invalid CTA URL is flagged in the owner dashboard completion checklist.
- If no CTA has been configured (possible for Unclaimed listings or new listings that have not yet completed setup), the system defaults to: "Learn More" for Business, which links to the entity's website if one exists, or hides the primary CTA button entirely and shows only Save + Share in the hero. An empty hero CTA is an incomplete Page state — the owner dashboard prompts the owner to set a CTA.

---

## 8. Accessibility Requirements Per Page

All BLACQList Pages must meet WCAG 2.1 AA. The following requirements are specific to the Page layout and its components.

### Heading Hierarchy

- Exactly one `<h1>` per Page: the entity name in the Hero section.
- Section headings (About, Services, Gallery, Trust, etc.) use `<h2>`.
- Sub-headings within sections (e.g., individual days in the hours block, sub-section labels) use `<h3>`.
- No heading levels are skipped. No visual heading is implemented as a bold `<p>` or `<div>`.

### Image Alt Text

- Hero cover image: `alt="[Entity name] cover photo"`. Decorative overlay gradient: no alt (CSS background, not `<img>`).
- Gallery images: `alt="[Entity name] — [caption if available, otherwise: Photo [N] of [M]]"`.
- Trust badge icon: `alt="[Trust tier name] badge"` (e.g., "Claimed badge").
- Social media icons: `aria-label="[Platform name] (opens in new tab)"` on the `<a>` wrapper; icon itself is `aria-hidden="true"`.
- Listing cards in Related Discovery: `alt="[Related entity name] — [category] in [city]"`.

### CTA Keyboard Access

- Primary CTA button: focusable via Tab, activatable via Enter and Space. Focus style: `outline: 2px solid #FFD867` (Light Gold) with `outline-offset: 2px`. The Amber Gold background provides sufficient contrast for the focus outline to be distinct.
- Quick Action Bar CTAs: same keyboard access requirements as hero buttons. The bar becomes reachable when the hero is no longer in the viewport — tab order follows DOM order, so the bar's CTAs appear in tab sequence after the hero's CTAs as the user scrolls.
- Save button: `aria-label="Save [entity name]"` when unsaved; `aria-label="Remove [entity name] from saved"` when saved. State change must be announced to screen readers via `aria-live="polite"` region.
- Share button: `aria-label="Share [entity name]"`.

### Gallery Keyboard Navigation

- Gallery grid: each thumbnail is a `<button>` (not `<a>`) that opens the lightbox. Focusable via Tab.
- Lightbox: when opened, focus is moved programmatically to the lightbox container. `role="dialog"` with `aria-label="Photo [N] of [M]: [caption]"`. Focus is trapped within the lightbox while open.
- Lightbox navigation buttons ("Previous", "Next"): `aria-label="Previous photo"` / `aria-label="Next photo"`. Keyboard: left/right arrow keys navigate in addition to Tab.
- Lightbox close: Escape key closes the lightbox. Focus returns to the thumbnail that triggered the lightbox open.

### Sticky Bar Focus Management

- The Quick Action Bar appears and disappears based on scroll position. When it enters sticky state, it is visually visible but its DOM position remains unchanged — it does not inject or remove from the DOM based on scroll (which would cause focus loss). It uses CSS `position: fixed` + `visibility: visible/hidden` or `opacity: 0/1` to show/hide without DOM manipulation.
- When the bar becomes visible, no automatic focus shift occurs — focus remains where the user last placed it. This prevents disorienting focus jumps during scroll.

### `aria-live` Regions

- Save state change: `aria-live="polite"` region announces "Saved to your list" or "Removed from your list" on save toggle.
- Quick Action Bar CTA: no `aria-live` needed — the CTA is a persistent button, not a dynamic state.
- Form submissions (owner dashboard only, not public Pages): submission result announced via `role="status"`.
- Open/Closed indicator: this is updated client-side on mount based on current time. The `<span>` containing the open/closed text has `aria-live="polite"` to announce the computed status to screen readers that may have loaded the static "Closed" server-rendered value.

### Modal Dialogs

- Sign-in prompt (triggered when anonymous user taps Save): `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to dialog heading ID. Focus trapped within dialog. Escape or "Cancel" closes the dialog. Focus returns to the Save button that triggered it.
- Lightbox: same modal requirements as above.
- Share sheet / copy-link modal: same modal requirements.

### Color-Only Information

- Open/Closed indicator uses both color (green/red dot) and text ("Open now" / "Closed") — color is not the sole indicator.
- Trust badges use both color and text label — the badge is never a color-only indicator.
- Save button state uses both fill (Amber Gold fill vs. outline) and `aria-label` text — not color alone.
- Star rating displays include numeric text ("4.5 out of 5") in addition to visual stars.

### Touch Target Minimums

- Minimum 44×44px for all interactive elements on mobile.
- Primary CTA in hero: minimum 48px height on mobile.
- Quick Action Bar CTA: minimum 44px height within 52px bar.
- Gallery thumbnails: minimum 44px on the smallest axis (at 2-column grid on 375px, each thumbnail is approximately 175px × 175px — well above minimum).
- Save and Share icon buttons: exactly 44×44px touch target with icon centered within.

---

## 9. SEO Signals Per Page Type

### Business

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/LocalBusiness` (or appropriate sub-type: `Restaurant`, `HealthAndBeautyBusiness`, etc. based on category) |
| `<title>` template | `[Business Name] — [Primary Category] in [City] \| The BLACQList` |
| Meta description template | `[Business Name] is a Black-owned [category] in [city]. [First 120 chars of description]. Find contact info, hours, and photos on The BLACQList.` |
| OG image strategy | Dynamically generated via `/og/[params]` API route: cover image as background + entity name + BLACQList wordmark overlay. 1200×630px. |
| Canonical URL | `/[city-slug]/business/[listing-slug]` |
| JSON-LD fields | `name`, `description`, `address`, `telephone`, `email`, `url`, `openingHours`, `image`, `geo`, `priceRange`, `hasMap`, `sameAs` (social links) |

### Professional (Beta)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/Person` with `jobTitle` and `worksFor` where available |
| `<title>` template | `[Full Name] — [Profession/Specialty] in [City] \| The BLACQList` |
| Meta description template | `[Full Name] is a Black [profession] in [city]. [First 120 chars of bio]. Explore their services and portfolio on The BLACQList.` |
| OG image strategy | Cover image (if provided) or auto-generated gradient background with name overlay. 1200×630px. |
| Canonical URL | `/[city-slug]/professional/[listing-slug]` |
| JSON-LD fields | `name`, `description`, `address`, `telephone`, `email`, `url`, `image`, `sameAs` |

### Creative (Beta)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/Person` or `schema.org/Organization` (depends on whether it is an individual or a creative studio) |
| `<title>` template | `[Name] — [Medium/Discipline] in [City] \| The BLACQList` |
| Meta description template | `[Name] is a Black [medium/discipline] in [city]. [First 120 chars of bio]. See their portfolio on The BLACQList.` |
| OG image strategy | First portfolio image (highest SEO value for creatives) as OG background + name overlay. Falls back to cover image. 1200×630px. |
| Canonical URL | `/[city-slug]/creative/[listing-slug]` |
| JSON-LD fields | `name`, `description`, `image` (portfolio images as `ImageObject` array), `url`, `sameAs` |

### Event (Beta)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/Event` |
| `<title>` template | `[Event Name] — [City], [Month Day, Year] \| The BLACQList` |
| Meta description template | `[Event Name] takes place on [Date] at [Location] in [City]. [First 120 chars of description]. Get tickets or RSVP on The BLACQList.` |
| OG image strategy | Event cover image + event name + date overlay. 1200×630px. |
| Canonical URL | `/events/[event-slug]` |
| JSON-LD fields | `name`, `description`, `startDate`, `endDate`, `location`, `image`, `url`, `organizer`, `offers` (ticket tiers + links) |

### Job (Beta)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/JobPosting` |
| `<title>` template | `[Job Title] at [Company] — [City or Remote] \| The BLACQList` |
| Meta description template | `[Company] is hiring a [Job Title] in [city]. [First 120 chars of job description]. Apply on The BLACQList.` |
| OG image strategy | Auto-generated with company name and role title on Cream or Deep Background. Falls back to company cover image. 1200×630px. |
| Canonical URL | `/jobs/[job-slug]` |
| JSON-LD fields | `title`, `description`, `datePosted`, `validThrough` (deadline), `hiringOrganization`, `jobLocation`, `baseSalary` (if provided), `employmentType`, `directApply` |

### Vendor (V2)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/OnlineStore` or `schema.org/Store` |
| `<title>` template | `[Vendor Name] — Black-owned [Category] Shop \| The BLACQList Marketplace` |
| Meta description template | `Shop [Vendor Name] — a Black-owned [category] vendor. [First 120 chars of description]. Browse products on The BLACQList Marketplace.` |
| OG image strategy | Vendor cover image + wordmark. 1200×630px. |
| Canonical URL | `/marketplace/vendor/[vendor-slug]` |
| JSON-LD fields | `name`, `description`, `url`, `image`, `address`, `openingHours` (if applicable) |

### Product (V2)

| SEO element | Value / Template |
|---|---|
| Structured data type | `schema.org/Product` |
| `<title>` template | `[Product Name] by [Vendor Name] \| The BLACQList Marketplace` |
| Meta description template | `[Product Name] by [Vendor Name] — [First 120 chars of product description]. Shop on The BLACQList.` |
| OG image strategy | First product image as OG image. 1200×630px. |
| Canonical URL | `/marketplace/product/[product-slug]` |
| JSON-LD fields | `name`, `description`, `image`, `offers` (price, availability, currency), `brand` (vendor name) |

### Shared SEO rules across all Page types

- Every Page has a unique `<title>` and `<meta name="description">`. No two Pages share the same meta description.
- Every Page has `<link rel="canonical">` pointing to its own definitive URL. Prevents duplicate content if Pages are accessible via multiple URL patterns.
- Every Page has `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, and `twitter:card` meta tags.
- Every Page is included in the XML sitemap. The sitemap is regenerated on content change via ISR revalidation.
- All Pages are server-rendered (Next.js SSR or ISR). No client-side-only rendering of primary content. Google must be able to read the full page content without executing JavaScript.
- Pages include `<meta name="robots" content="index, follow">` when published. Unpublished / Draft Pages include `<meta name="robots" content="noindex, nofollow">` and are excluded from the sitemap.

---

## 10. Analytics Events Master List

| Event | Trigger | Entity types | Properties | Phase |
|---|---|---|---|---|
| `page_view` | Page is loaded | All | `entity_type`, `entity_id`, `listing_slug`, `trust_tier`, `is_claimed`, `listing_tier`, `referrer_source`, `referrer_path`, `city_slug`, `category_slug` | MVP |
| `hero_cta_click` | Primary CTA button in hero clicked | All | `entity_type`, `entity_id`, `cta_type`, `cta_label`, `trust_tier` | MVP |
| `save_toggled` | Save button in hero clicked | All top-level | `entity_type`, `entity_id`, `action` (`saved`/`unsaved`), `auth_state` (`authenticated`/`auth_gated`), `source` (`hero`) | MVP |
| `save_toggled` | Save button in Quick Action Bar clicked | All top-level | same as above + `source: 'action_bar'` | MVP |
| `save_toggled` | Save button on related discovery card clicked | All top-level | same + `source: 'related_discovery'` | MVP |
| `share_initiated` | Share button clicked (hero or action bar) | All top-level | `entity_type`, `entity_id`, `share_method` (`copy_link`/`native_share`/`social`), `source` | MVP |
| `action_bar_cta_click` | CTA in Quick Action Bar clicked | All | `entity_type`, `entity_id`, `cta_type`, `scroll_depth_pct` | MVP |
| `action_bar_phone_click` | Phone icon in Quick Action Bar tapped | Business, Professional, Creative, Vendor | `entity_type`, `entity_id` | MVP |
| `action_bar_map_click` | Map icon in Quick Action Bar tapped | Business, Professional, Creative, Event | `entity_type`, `entity_id` | MVP |
| `phone_click` | Phone `tel:` link in At-a-Glance tapped | Business, Professional, Creative, Vendor | `entity_type`, `entity_id`, `source: 'at_a_glance'` | MVP |
| `website_click` | Website link in At-a-Glance clicked | All applicable | `entity_type`, `entity_id` | MVP |
| `map_click` | Address map link in At-a-Glance tapped | Business, Professional, Event, Vendor | `entity_type`, `entity_id` | MVP |
| `email_click` | Email `mailto:` link in At-a-Glance tapped | All applicable | `entity_type`, `entity_id` | MVP |
| `social_link_click` | Social icon link in At-a-Glance clicked | All applicable | `entity_type`, `entity_id`, `platform` | MVP |
| `story_expanded` | "Read more" toggle in Story section clicked | Business, Professional, Creative, Vendor | `entity_type`, `entity_id` | MVP |
| `story_collapsed` | "Show less" toggle in Story section clicked | All applicable | `entity_type`, `entity_id` | MVP |
| `services_expanded` | "Show all services" button clicked | Business, Professional | `entity_type`, `entity_id`, `total_service_count` | MVP |
| `gallery_opened` | Gallery thumbnail clicked to open lightbox | Business, Professional, Creative, Event, Vendor | `entity_type`, `entity_id`, `image_index` | MVP |
| `gallery_navigated` | Left/right navigation used in lightbox | All applicable | `entity_type`, `entity_id`, `direction`, `image_index` | MVP |
| `gallery_closed` | Lightbox closed | All applicable | `entity_type`, `entity_id`, `last_image_index`, `total_images_viewed` | MVP |
| `trust_section_view` | Trust section scrolled into viewport | Business, Professional, Creative, Vendor | `entity_type`, `entity_id`, `trust_tier` | MVP |
| `claim_prompt_click` | "Claim Your Page" button in Trust section clicked | All unclaimed | `entity_type`, `entity_id` | MVP |
| `community_save_nudge_click` | Save button in Community Connection section clicked | Business, Professional, Creative, Vendor | `entity_type`, `entity_id`, `action`, `source: 'community_connection'` | MVP |
| `related_card_click` | Card in Related Discovery section clicked | All | `source_entity_type`, `source_entity_id`, `destination_entity_id`, `destination_entity_type`, `card_position` | MVP |
| `related_save_toggled` | Save button on related discovery card clicked | All applicable | `source_entity_id`, `destination_entity_id`, `action` | MVP |
| `video_embed_played` | Video embed play button pressed | All applicable | `entity_type`, `entity_id`, `video_url` | V1 |
| `correction_prompt_click` | "Suggest a correction" link clicked | All applicable | `entity_type`, `entity_id` | Beta |
| `review_form_opened` | "Write a review" button clicked | Business, Professional, Creative, Vendor | `entity_type`, `entity_id` | V1 |
| `review_helpful_voted` | Helpful vote button on a review clicked | Business, Professional, Creative, Vendor | `entity_id`, `review_id`, `vote_direction` | V2 |
| `owner_response_viewed` | Owner response visible on loaded page | Business, Professional, Creative, Vendor | `entity_id`, `review_id` | V1 |
| `collection_link_click` | Collection link in Platform Activity section clicked | All top-level | `entity_type`, `entity_id`, `collection_id`, `collection_slug` | V1 |
| `job_deadline_view` | Job page with deadline within 7 days loaded | Job | `entity_id`, `days_remaining` | Beta |
| `ticket_link_click` | Ticket or RSVP link clicked on Event page | Event | `entity_id`, `ticket_tier` | Beta |
| `apply_link_click` | Apply Now link clicked on Job page | Job | `entity_id` | Beta |
| `vendor_product_card_click` | Product card in vendor teaser grid clicked | Vendor | `entity_id` (vendor), `product_id` | V2 |
| `commission_status_view` | Creative page with commission status loaded | Creative | `entity_id`, `commission_status` | Beta |
| `product_add_to_cart` | Add to Cart button clicked on Product page | Product | `entity_id`, `product_id`, `variant_id` | V2 |
| `scroll_depth_25` | User scrolls to 25% of page | All | `entity_type`, `entity_id` | MVP |
| `scroll_depth_50` | User scrolls to 50% of page | All | `entity_type`, `entity_id` | MVP |
| `scroll_depth_75` | User scrolls to 75% of page | All | `entity_type`, `entity_id` | MVP |
| `scroll_depth_100` | User scrolls to 100% of page | All | `entity_type`, `entity_id` | MVP |

**Analytics implementation notes:**
- All events are fired via a thin client-side analytics wrapper that queues events and batches them to avoid impacting page performance. The wrapper calls the platform's analytics endpoint or a third-party analytics service (Posthog, Mixpanel, or equivalent — to be confirmed in architecture decisions).
- Scroll depth events use `IntersectionObserver` on sentinel divs placed at 25%, 50%, 75%, and 100% of page height — not a `scroll` event listener (avoids scroll jitter).
- `page_view` fires on the server side (via server action or middleware logging) to capture views from users with JavaScript disabled or blocked. Client-side `page_view` is a duplicate-safe enrichment event if the server-side event is the authoritative count.
- `view_count` (owner dashboard stat) is aggregated from `page_view` events filtered by `entity_id`. It is not a separate event — it is a query over the events table.
- All analytics events are associated with the authenticated user ID if the user is signed in, or with a session-scoped anonymous ID if not. Anonymous IDs are not persisted to localStorage — they are session-scoped to avoid privacy concerns.

---

*Recommended next artifact:* Data model — `docs/blacqlist/architecture/data-model.md`. The BLACQList Pages spec defines the complete field inventory for all entity types. The next step is formalizing the database schema: table structure for `listings`, `business_pages`, `professional_pages`, `creative_pages`, `event_pages`, `job_pages`, `vendor_pages`, `product_pages`, `services`, `media_attachments`, `saves`, `reviews`, `collections`, and the analytics events table. The schema should derive directly from the fields defined in this document.
