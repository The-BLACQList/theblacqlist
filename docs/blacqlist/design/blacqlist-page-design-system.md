# BLACQList Page Design System

**Last updated:** 2026-05-07
**Status:** Design direction — source of truth for BLACQList Page visual implementation
**Owner:** Design / Frontend Architecture
**Audience:** Designers producing mockups, frontend engineers implementing Pages, QA reviewing Page implementations

This document governs the visual design of every BLACQList Page — the polished micro-website that every listed entity receives on the platform. It is not a component code specification and contains no implementation code. It is a design language specification that a designer can use to produce high-fidelity mockups and a frontend engineer can implement without a separate design handoff session.

---

## 1. Design Principles for BLACQList Pages

These six principles govern every design decision made on a BLACQList Page. When a design choice is ambiguous, return to these principles first.

### 1.1 Editorial Quality Over Form-Fill

A BLACQList Page is not a filled-out directory form displayed as data. It is a purposefully laid-out presentation of an entity. Every section should feel like a magazine feature — generous whitespace, strong imagery, confident typography — not a database record rendered to the screen. If a section looks like a form, the design is wrong.

### 1.2 Amber Gold Is for Action, Not Decoration

Amber Gold (`#E2A428`) carries the full weight of call-to-action on every Page. Every Amber Gold element says: "this is something you can do." Use it on primary CTAs, badge highlights, and featured states — nowhere else. The moment Amber Gold appears as a decorative element (a border, a background tint, a separator), it loses its ability to direct attention to actions. Protect this color's signal value.

### 1.3 Images Are Mandatory, Not Optional

A BLACQList Page without a cover image is an incomplete product. The image is the emotional entry point — it establishes trust, communicates quality, and makes the page feel like something real exists behind it. The design system assumes every Page has a cover image. Empty-image states are handled by the owner dashboard, not the public Page. Empty gallery sections are hidden rather than shown as empty.

### 1.4 Mobile Is the Primary Viewport

The majority of Page visitors will arrive on a mobile device — from a shared link, from a search result, from a social post. Every layout decision is made mobile-first. Desktop is an enhancement. When a design element cannot work on a 375px screen, it is not the right design element.

### 1.5 Trust Signals Are Visible but Never Dominant

The trust badge system (Unclaimed / Claimed / Verified / BLACQList Certified) is a critical feature of the platform. It must be visually present and immediately readable. But trust badges must not compete with the entity's identity or the primary CTA for visual attention. A badge is a supporting signal, not a headline. Position it clearly, size it appropriately, and let the entity's own content — name, image, story — carry the primary weight.

### 1.6 Dark Surfaces for Impact, Light Surfaces for Reading

The hero and a select few high-impact sections use deep dark backgrounds (`#19191E`) to create the premium, cinematic quality of the BLACQList brand. All content-heavy sections — story, services, reviews — use light backgrounds (`#FCFAF4`, `#E9E9F7`, `#FFFFFF`) because that is where reading happens. Dark surfaces impress; light surfaces inform. Never mix them within a single section.

---

## 2. Page-Level Layout Architecture

### 2.1 Viewport and Max-Width

**Content width:** BLACQList Pages use a maximum content width of 960px, centered with auto horizontal margins (`max-w-[960px] mx-auto`). This is narrower than typical marketing pages and intentional — it produces a more editorial, focused reading experience.

**Full-bleed elements:** Two categories of element bleed to the full viewport width regardless of the 960px content constraint:
- The hero section cover image (always full viewport width)
- Section backgrounds (background colors extend to viewport edges; content inside the background is still constrained to 960px)

**Sticky navigation:** The main platform nav bar is a separate system from the BLACQList Page layout. On BLACQList Pages, the nav begins transparent (overlaying the top of the hero image with no background color) and transitions to a solid Deep Background (`#19191E`) as soon as the user scrolls past the hero section. This transition is a smooth opacity fade, not a jump. On mobile, the nav collapses to the hamburger/avatar pattern defined in the navigation model.

**Quick Action Bar:** A second sticky element specific to BLACQList Pages. Position: fixed to the bottom of the viewport on mobile; fixed to the top of the viewport just below the platform nav on desktop. The bar is hidden while the hero's primary CTA button is in view. It becomes visible the moment the hero scrolls out. It hides again when the page footer enters view. Details in Section 4.

**Responsive layout summary:**

| Viewport | Content width | Padding | Notable behavior |
|---|---|---|---|
| Mobile (375px) | Full viewport | 16px horizontal padding | Single column; bottom sticky action bar; hero image above entity name |
| Tablet (768px) | Full viewport | 24px horizontal padding | Single column; begins to use horizontal row layouts for At-a-Glance |
| Desktop (1024px+) | 960px max, centered | 32px horizontal padding | Full layout; sticky action bar appears at top; all multi-column grids active |
| Large desktop (1280px+) | 960px max (no wider) | Auto outside margins | Outer margins visible; page feels contained and editorial rather than stretched |

---

### 2.2 Section Rhythm and Spacing

**Vertical section spacing:** Each section is separated from the next by a vertical padding of 64px top and bottom on desktop, 48px on mobile. No horizontal rules between sections — background color alternation provides the visual separation.

**Background color alternation pattern for a Business Page (the primary template):**

| Section | Background |
|---|---|
| Hero | Full-bleed cover image + gradient overlay; background beneath image is `#19191E` |
| Quick Action Bar | `#19191E` (Dark) — desktop top bar; on mobile, `#19191E` sticky bottom bar |
| At-a-Glance | `#FFFFFF` (White) |
| Story | `#FCFAF4` (Cream) |
| What They Offer | `#FFFFFF` (White) |
| Media | `#19191E` (Deep Background) — the gallery feels like a curated editorial spread |
| Trust | `#E9E9F7` (Pale Lavender) — a distinct, calm register for credibility content |
| Community Connection | `#FFFFFF` (White) |
| Platform Activity | `#FCFAF4` (Cream) |
| Related Discovery | `#E9E9F7` (Pale Lavender) |

The rhythm alternates between White and Cream for content sections, uses Pale Lavender for trust-adjacent and discovery sections, and uses Deep Background for the hero and gallery. This rhythm keeps the page visually active without being busy.

**Within-section spacing:**
- Section heading to first content element: 24px
- Between content items within a section (service rows, review cards): 16px
- Card internal padding: 24px
- Icon-to-label gap in At-a-Glance: 8px

---

### 2.3 Typography Scale on BLACQList Pages

All sizes below are defined in points and described in approximate Tailwind equivalents for reference. The exact rendering depends on the font metrics of Glacial Indifference, Lato, and Quicksand as loaded.

| Element | Font | Weight/Style | Desktop size | Mobile size | Color |
|---|---|---|---|---|---|
| Entity name (h1) | Glacial Indifference | Bold | 40px | 28px | `#FFFFFF` (on dark hero) |
| Section header (h2) | Glacial Indifference | Bold | 28px | 22px | `#000000` on light; `#FFFFFF` on dark |
| Sub-section header (h3) | Lato | Regular | 18px | 16px | `#000000` on light; `#FFFFFF` on dark |
| Body copy | Quicksand | Bold Italic | 16px | 15px | `#000000` on light; `#FFFFFF` on dark |
| CTA label | Quicksand | Bold Italic | 16px | 15px | `#000000` (on Amber Gold button); `#FFFFFF` (on dark button) |
| Category/city label | Lato | Regular | 14px | 13px | `#595758` (Charcoal) on light backgrounds |
| Trust badge text | Lato | Regular | 13px | 12px | Color defined per tier (see Section 9) |
| Hours / metadata | Lato | Regular | 14px | 13px | `#595758` (Charcoal) |
| Price in services | Lato | Regular | 14px | 14px | `#E2A428` (Amber Gold) on light; `#FFD867` (Light Gold) on dark |
| Review text | Quicksand | Bold Italic | 15px | 14px | `#000000` |
| Tagline | Lato | Regular | 18px | 15px | `#E9E9F7` (Pale Lavender) on dark hero |
| Save count / activity | Lato | Regular | 14px | 13px | `#595758` (Charcoal) |
| "Read more" / expand toggle | Lato | Regular | 14px | 13px | `#E2A428` (Amber Gold) |

**Line height:** Body copy uses a line height of 1.6 (generous for Quicksand Bold Italic at body sizes). Headings use a line height of 1.15 (tight, editorial). Metadata rows use a line height of 1.4.

**Do not use Amber Gold for body text.** The one exception is the expand/collapse toggle ("Read more" / "Read less") which uses Amber Gold because it is functionally a link, not prose.

**Maximum line length:** Body copy should not exceed 680px in rendered width. The 960px container with 32px horizontal padding naturally produces this result on desktop. No additional max-width constraint is needed on body text within the 960px container.

---

## 3. Hero Section Design

### 3.1 Business Hero

**Cover image dimensions and treatment:**

The cover image always fills the full viewport width. The image's height is capped: 560px on desktop (approximately 56vh at 1000px viewport height), 240px on mobile. The image is rendered as an `object-fit: cover` fill, anchored to the vertical center of the image. The entity owner provides the image at any reasonable resolution; the platform crops and optimizes it.

On the Free and Standard tiers, the hero image is contained within a card-like frame: the 960px content container has rounded top corners (12px radius), and the image sits within that bounded container with a visible margin on the left and right sides of the page (the Cream or White page background is visible on either side of the image). This boxed treatment communicates the free/standard tier without being punitive — it still looks polished.

On the Premium tier, the hero image is truly full-bleed: it extends edge-to-edge across the full viewport width with no side margins. The rounded-corner framing is removed.

**Gradient overlay:** All hero images — both Free/Standard and Premium — have a bottom-to-top linear gradient overlay. The gradient goes from `rgba(0, 0, 0, 0.72)` at the bottom edge of the image (where the entity name and CTA live) to `rgba(0, 0, 0, 0)` at the top 40% of the image (so the image itself is visible and visually clear). This gradient ensures text legibility on any cover image without requiring the owner to submit a carefully composed photo. The gradient is always present; it is not optional.

**Entity name placement:**
The entity name (h1, Glacial Indifference Bold, 40px desktop / 28px mobile, white) is positioned in the lower-left quadrant of the hero image, sitting atop the dark gradient. On desktop, the name is positioned 32px from the left edge of the content container and 72px from the bottom edge of the hero image area. On mobile, it is 16px from the left edge and 64px from the bottom.

**Tagline placement:**
If a tagline exists, it appears in Lato Regular 18px / 15px mobile, Pale Lavender (`#E9E9F7`), directly below the entity name. Maximum one line; truncated with ellipsis if longer. On mobile the tagline may be hidden if the hero height is at the minimum 240px — it is optional information in the mobile hero.

**Primary CTA button:**
Position: immediately below the tagline (or below the entity name if no tagline), on the lower-left of the hero image on desktop. On mobile, below the entity name in the lower section of the image or immediately below the image in a constrained bar at the same vertical position.

Button style: Amber Gold (`#E2A428`) background, Brand Black (`#000000`) text label in Quicksand Bold Italic 16px, 12px top/bottom padding, 24px left/right padding, 8px border radius. The label is the owner-configured CTA type: "Book Now", "Order Online", "Call Us", "Visit Us", or "Message Us". Button minimum width: 140px.

**Save and Share buttons:**
Position: adjacent to the primary CTA on desktop (to the right of the CTA button, in the same horizontal row). On mobile: stacked below the primary CTA, displayed as icon-only circular buttons (40px diameter) with a semi-transparent dark background (`rgba(0, 0, 0, 0.5)`) and a White icon. Save uses a bookmark/heart icon; Share uses a share icon. Save state: outline icon when not saved, filled White icon when saved.

**Trust badge position:**
On desktop: upper-left of the hero image, 16px from the top edge and 16px from the left edge of the content container (on top of the image, not below it). On mobile: same upper-left position but at 12px margins. The badge sits on top of the image, not below it, so it is visible as soon as the user arrives on the page. Badge visual specs in Section 9.

**Logo treatment (if provided):**
If the entity has uploaded a logo, it appears as a circular-cropped image of 64px diameter (desktop) / 48px diameter (mobile), positioned to the left of the entity name in the lower section of the hero gradient. It sits on the same horizontal baseline as the entity name. The logo has a thin 1.5px White border to create separation from the image behind it.

**Free/Standard vs Premium hero summary:**

| Element | Free / Standard | Premium |
|---|---|---|
| Image width | Constrained to 960px content container with visible page background on sides | Full viewport width, edge-to-edge |
| Image border radius | 12px top corners, 0 bottom (since content continues below) | 0 (no radius — full bleed) |
| Gradient overlay | Present | Present (same spec) |
| Max image height | 440px desktop | 560px desktop |
| All other elements | Identical | Identical |

---

### 3.2 Professional Hero

The Professional hero replaces the full-bleed business cover image layout with a structured split-panel layout.

**Layout:** On desktop, a two-column layout. Left column (40% width): a circular headshot portrait, 280px diameter, centered vertically in the hero area, with a thin 2px ring in Amber Gold (`#E2A428`). Right column (60% width): stacked from top — credential/title line in Lato Regular 16px Charcoal, then name in Glacial Indifference Bold 36px Brand Black, then specialty/tagline in Quicksand Bold Italic 17px Charcoal, then a row of credential pills (e.g., "Licensed" or "Certified" in Pale Lavender pill badges), then the primary CTA button ("Book a Consultation" or "Book Appointment" in Amber Gold).

**Background:** The hero area has a Cream (`#FCFAF4`) background — no full-bleed image. The circular portrait provides the visual focal point.

**On mobile:** Single column. Portrait centered at top (200px diameter), name and credentials below, CTA below that.

**Trust badge:** Upper-right of the right panel on desktop. Upper-right of the stacked layout on mobile.

**No address or hours in the hero:** Professional pages surface these in At-a-Glance, not in the hero.

---

### 3.3 Creative Hero

The Creative hero treats the cover image as a portfolio showcase.

**Layout:** Similar to Business hero with the same full-bleed treatment, but the entity name is smaller (32px desktop) and the medium/genre badge is visually prominent — displayed as a large pill badge in Pale Lavender with Brand Black text, positioned above the entity name in the gradient overlay area.

**CTA label:** "Commission" or "Book Me" rather than a commerce CTA. The label is owner-configured.

**Visual difference from Business:** The hero reads as "creative portfolio" rather than "commercial storefront." The medium badge does this — it communicates artistry before commerce.

**On mobile:** Same as Business hero mobile behavior with the medium badge above the name.

---

### 3.4 Event Hero

The Event hero subordinates the entity name to the date and time. The date is the primary information the visitor needs.

**Date block:** In the lower-left of the hero image gradient area, the date is rendered in Glacial Indifference Bold 36px white on desktop / 24px on mobile. Format: "SAT 14 JUN · 7:00 PM". This is larger than the event name.

**Event name:** Below the date block, in Glacial Indifference Bold 24px white desktop / 18px mobile. The name is subordinate to the date.

**Location:** Below the event name, in Lato Regular 15px Pale Lavender.

**CTA button:** "Get Tickets" or "RSVP" in Amber Gold. Same button style as Business hero CTA.

**Past event state:** When the event date has passed, a semi-transparent dark overlay sits on top of the entire hero image (darker than the normal gradient, full-image coverage at approximately 60% opacity). On top of this overlay, centered, a "Past Event" badge in Charcoal pill style. The entity name is visible but the CTA button is replaced by a disabled "Event Ended" ghost button.

---

### 3.5 Job Hero

**Layout:** No full-bleed cover image. The Job hero is a structured, contained card layout on a Pale Lavender (`#E9E9F7`) background.

**Card content:** Company logo (rectangular or circular, 60px height) in the upper-left. Role title in Glacial Indifference Bold 32px Brand Black as the h1. Below the title: company name in Lato Regular 18px Charcoal, then a row of three badge pills — location badge (pin icon), employment type badge (full-time/part-time/contract), salary range badge (if provided). Then the "Apply Now" Amber Gold button.

**Apply-by deadline:** Displayed below the CTA button in Lato Regular 14px Charcoal: "Apply by [Month Day, Year]".

**Expired/closed state:** The hero card takes on a Charcoal (`#595758`) background tint (reduced opacity overlay). The CTA button is replaced by a static "Position Closed" pill badge in Charcoal. The deadline text becomes "Closed on [date]".

**No trust badge on Job hero:** Jobs are posted by employers; the trust badge system applies to businesses and professionals, not individual job postings.

---

### 3.6 Vendor Hero

The Vendor hero uses the same full-bleed cover image layout as the Business hero with two additions.

**Additional secondary CTA:** Below the primary CTA button, a second button in ghost/outline style (White border, White text) with the label "Browse Products" or "Shop Now". This is a secondary action that scrolls to the Product Grid section of the page.

**Vendor badge:** A small "Vendor" or "Shop" indicator badge (not a trust badge — this is a page-type indicator) appears adjacent to or below the trust badge. Charcoal background, White text, 11px Lato Regular. This tells the visitor immediately that this is a commerce-enabled entity.

---

### 3.7 Product Sub-Page Hero

Product sub-pages live within a Vendor's or Business's page structure. The hero is closer to a product detail page than a brand hero.

**Layout:** On desktop, a two-column layout. Left column (50%): a primary product image, square aspect ratio (1:1), 480px max width, with a row of 3–4 thumbnail images below it (60px × 60px) that switch the main image on click/tap. Right column (50%): product name in Glacial Indifference Bold 28px Brand Black, price in Lato Regular 28px Amber Gold (`#E2A428`), a short product description in Quicksand Bold Italic 15px Charcoal (maximum 3 lines with expand), variant selectors (size, color as pill buttons if applicable), and the primary CTA button ("Add to Cart" in Amber Gold, full-width in the right column, or "Buy Now").

**Vendor attribution link:** Below the CTA button, in Lato Regular 14px Charcoal: "By [Vendor Name] →" as a clickable link to the Vendor's BLACQList Page.

**On mobile:** Single column; product image full-width at top, content stacked below.

**Trust badge:** Not present on Product sub-pages. Trust is inherited from the parent Vendor/Business page.

---

### 3.8 Service Sub-Page Hero

Service sub-pages are simpler than product pages — they describe a service, not a physical item.

**Layout:** A contained card on a Cream background. Service name in Glacial Indifference Bold 28px Brand Black as h1. Provider name as a clickable link in Lato Regular 16px Amber Gold: "By [Provider Name]". Price or price range in Lato Regular 22px Charcoal (not Amber Gold — services have more pricing complexity and Amber Gold at this size would feel pressuring). Duration (if applicable) in Lato Regular 14px Charcoal. Then the CTA button: "Book" or "Inquire" in Amber Gold.

---

## 4. Quick Action Bar

### 4.1 Behavior

The Quick Action Bar is a secondary navigation element that maintains access to the primary CTA after the hero scrolls out of view. It is not a general navigation bar — it contains only Page-specific actions.

**Visibility trigger:** The bar becomes visible when the hero's primary CTA button scrolls above the top of the viewport (i.e., when the hero is no longer fully in view). Detection mechanism: an intersection observer on the hero CTA button element. When the hero CTA enters the viewport again (user scrolls back up), the bar hides.

**Dismissal at page bottom:** The bar hides again when the visitor scrolls to the bottom of the page (approximately when the Related Discovery section comes into view). This prevents the bar from competing with the page footer.

**Transition:** Opacity and vertical transform transition. The bar slides up from below the viewport on mobile (entering from bottom), or slides down from above on desktop (entering from below the platform nav). Duration: 200ms, ease-out.

**Z-index:** Above page content, below platform modals and dialogs.

### 4.2 Contents and Order

**Mobile layout (sticky bottom bar):**
Full-width bar, 56px height, Deep Background (`#19191E`) background, 1px top border in `rgba(255, 255, 255, 0.1)`.

Left-to-right content:
1. Primary CTA button — Amber Gold background, Brand Black Quicksand Bold Italic label, full-width but leaving room for the icon buttons. This button fills approximately 55% of the bar width.
2. Phone icon button — White icon, 44px tap target, only rendered if the entity has a phone number. Icon-only on mobile. Tap opens `tel:` link.
3. Map/Directions icon button — White pin icon, 44px tap target, only rendered if the entity has a physical address. Tap opens maps link. Hidden for service-area businesses and remote/online entities.
4. Save icon — bookmark/heart outline icon (filled when saved), White, 44px tap target.
5. Share icon — White, 44px tap target.

The three or four icon buttons fill the remaining 45% of the bar width, distributed evenly with no labels.

**Desktop layout (sticky top bar, below platform nav):**
Full-width bar, 52px height, Deep Background (`#19191E`) background.

Left-to-right content:
- Left side: Entity name in Lato Regular 14px White (truncated with ellipsis if longer than 200px). This orients the user who may have scrolled far down the page.
- Right side: Flex row of action elements: Primary CTA button (same Amber Gold style, not full-width — sized to its label), then a phone button with icon + truncated phone number in White Lato Regular 13px (only if phone exists), then map button (icon only), then Save button (icon + "Save" label in White 13px), then Share button (icon + "Share" label in White 13px).

### 4.3 Mobile vs Desktop Differences

| Element | Mobile | Desktop |
|---|---|---|
| Position | Fixed bottom | Fixed top (below platform nav) |
| Height | 56px | 52px |
| Primary CTA width | ~55% of bar | Auto-width, content-fit |
| Entity name | Not shown | Shown (left side) |
| Phone button | Icon only | Icon + truncated number |
| Gap between CTA and icons | 8px | 16px |

---

## 5. At-a-Glance Section

The At-a-Glance section is the first content section below the hero. Its job is to answer five questions in five seconds: What type of entity is this? Where are they? Are they open? How do I reach them? What are their hours?

**Background:** White (`#FFFFFF`), full-width background, 960px content constraint.

**Desktop layout:** A single horizontal row, all items on one line if they fit, wrapping to two lines if necessary. Items are left-to-right with 24px gaps between each item group. The row has 32px top and bottom padding.

**Mobile layout:** A stacked vertical list with 12px between each item. Each item is full-width.

**Item specifications:**

| Item | Icon | Label | Detail | Condition |
|---|---|---|---|---|
| Category | Category icon (from brand icon set) in 18px Charcoal | None | Category name in Lato Regular 14px Charcoal | Always shown |
| City | Pin icon, 16px Charcoal | None | City name in Lato Regular 14px Charcoal | Always shown |
| Hours | Clock icon, 16px | "Open now" in 13px green (`#16A34A`) or "Closed" in 13px Charcoal | Today's hours range in Lato Regular 13px Charcoal. "Opens at [time]" shown when closed. | Only shown for entities with hours |
| Phone | Phone icon, 16px Amber Gold | None | Phone number as tappable link, Lato Regular 14px Brand Black | Only shown if phone exists |
| Email | Envelope icon, 16px Charcoal | None | Email address as `mailto:` link, truncated if longer than 24 chars, Lato Regular 14px Brand Black | Only shown if email exists |
| Website | Globe icon, 16px Charcoal | None | Domain only (strip `https://www.`) as external link, Lato Regular 14px Amber Gold | Only shown if website exists |

**Event variant:** Date/time block replaces hours. Displayed as: calendar icon + "SAT 14 JUN · 7:00 PM" in Glacial Indifference Bold 16px Brand Black. Location below on same row or second line.

**Job variant:** Location badge (pin icon + city name), employment-type badge (briefcase icon + "Full-Time" or type), salary range in Lato Regular 14px Charcoal (if provided), and "Apply by [date]" in Lato Regular 13px Charcoal with a clock icon.

**Product variant:** Price in Lato Regular 18px Amber Gold (prominent), variant indicators if applicable (e.g., "3 sizes available"), stock status badge (In Stock / Low Stock / Out of Stock).

---

## 6. Story Section

### 6.1 Business / Professional / Creative / Vendor Story

**Background:** Cream (`#FCFAF4`).

**Section heading:** "About" or "Our Story" in Glacial Indifference Bold 28px Brand Black.

**Body text:** Entity description in Quicksand Bold Italic 16px Brand Black, line height 1.6. Left-aligned. No centered text for body copy of this length.

**Truncation:** If the description exceeds 200 words (approximately 4 lines of body copy at this size), the text is visually truncated with a soft gradient fade at the bottom of the collapsed view. A "Read more" expand link appears in Amber Gold Lato Regular 14px. Clicking expands to full text. A "Read less" link collapses it again. The collapse/expand is a smooth height transition, not an abrupt show/hide.

**Maximum display length:** No character limit enforced in this section's visual design. The truncation handles any length.

**No rich text at MVP.** The description is plain text. Paragraph breaks are preserved by splitting on double newlines and rendering each as a separate paragraph element with 16px bottom margin.

### 6.2 Product Description

Same typography rules as 6.1. No heading — the product name from the hero serves as the heading. Description is shorter (typically 50–200 words for a product). The expand/collapse truncation threshold is lower: 100 words.

---

## 7. What They Offer Section

### 7.1 Services List (Business / Professional)

**Background:** White (`#FFFFFF`).

**Section heading:** "Services" in Glacial Indifference Bold 28px Brand Black. Subheading (optional, set by entity owner): Lato Regular 16px Charcoal.

**Service item layout:** Each service is a row item with a subtle bottom border in Pale Lavender (`#E9E9F7`). No card shadows — clean row list, not a card grid.

Each row contains:
- Service name: Lato Medium (semibold) 16px Brand Black, left-aligned
- Service description (if provided): Quicksand Bold Italic 14px Charcoal, below the name, maximum 2 lines with ellipsis
- Price (if provided): Right-aligned within the row, Lato Regular 14px Amber Gold. If no price, this space is empty (no "Contact for pricing" placeholder in this design).
- No icons per service at MVP — the list relies on typography contrast.

**Maximum visible at MVP:** 8 service rows. If more than 8 services exist, the remaining are hidden with a "Show all [N] services" expand link in Amber Gold at the bottom of the list.

**Empty state on public page:** Section is hidden entirely. The owner is prompted to add services in their dashboard, not on the public page.

### 7.2 Portfolio / Commissions (Creative)

**Background:** White (`#FFFFFF`).

**Section heading:** "Portfolio" in Glacial Indifference Bold 28px Brand Black.

**Portfolio grid:** A 3-column grid on desktop, 2-column on tablet, 2-column on mobile. Each portfolio item is a square image (1:1 aspect ratio). On hover (desktop), a dark overlay appears over the image with the item title in Lato Regular 14px White. On mobile, the title appears below the image in Lato Regular 13px Charcoal (no hover).

**Commission inquiry block:** Below the portfolio grid, a visually separated block (Pale Lavender background, 24px padding, 8px border radius): heading "Commission Inquiries" in Glacial Indifference Bold 20px Brand Black, a one-sentence description in Quicksand Bold Italic 14px Charcoal, and a "Reach Out" Amber Gold button.

### 7.3 Event Details

**Background:** White (`#FFFFFF`).

**Section heading:** "Event Details" in Glacial Indifference Bold 28px Brand Black.

**Date/time/location block:** A bordered card (1px Pale Lavender border, 8px radius, 24px padding) containing the full date, start and end time, location name, and street address. All in Lato Regular at appropriate sizes. The Ticket/RSVP CTA button (Amber Gold) is repeated here, to the right of or below the date/time block on desktop.

**Event description:** Full event description in Quicksand Bold Italic 16px Brand Black below the detail block. Same truncation behavior as Story section.

### 7.4 Job Description

**Background:** White (`#FFFFFF`).

**Section heading:** "About This Role" in Glacial Indifference Bold 28px Brand Black.

**Job description body:** Quicksand Bold Italic 16px Brand Black, full text, no truncation (job descriptions are by nature the information the candidate needs to read in full).

**Requirements list:** A bulleted list below the description. Each bullet item in Lato Regular 15px Brand Black, left margin 16px, bullet marker in Amber Gold.

**Compensation section:** If provided, a visually distinct block: "Compensation" in Glacial Indifference Bold 18px Brand Black, compensation details in Quicksand Bold Italic 16px Charcoal.

**Apply CTA (repeated):** The Amber Gold "Apply Now" button appears at the bottom of this section, full-width on mobile, auto-width on desktop.

### 7.5 Product Grid (Vendor)

**Background:** White (`#FFFFFF`).

**Section heading:** "Products" in Glacial Indifference Bold 28px Brand Black.

**Product card grid:** 2-column on mobile, 3-column on desktop with 16px gap between cards. Each product card:
- Product image: square (1:1 aspect ratio), full width of the card column, 8px top border radius matching the card
- Product name: Lato Regular 15px Brand Black, 2-line max with ellipsis
- Price: Lato Regular 15px Amber Gold
- A "Shop Now" Amber Gold text link with arrow at the bottom of the card, routing to an external vendor URL at MVP

**Card container:** 1px Pale Lavender border, 8px border radius, 0 shadow on rest state, subtle shadow on hover (desktop).

**Product grid at MVP:** Links out to external vendor URLs. The "Add to Cart" functionality is V2.

---

## 8. Media Section

### 8.1 Gallery (Business / Vendor)

**Background:** Deep Background (`#19191E`).

**Section heading:** "Photos" in Glacial Indifference Bold 28px White.

**Gallery grid layout:** A two-row, mixed-size layout. On desktop: the first image is displayed at large size occupying the full left half of the content area (approximately 460px × 320px). The remaining images fill a 2-column grid on the right half. On mobile: single image featured at full width (375px × 240px), then 2-column grid for remaining images below.

**Image count indicator:** Below the grid, a "View all [N] photos" Amber Gold text link that opens the lightbox gallery.

**Lightbox behavior:** Opens as a modal overlay on the full viewport. Background: `rgba(0, 0, 0, 0.92)`. The current image is centered with max dimensions of 90% viewport width and 85% viewport height, maintaining its original aspect ratio. Image counter in White Lato Regular 14px in the upper-right corner: "3 / 12". Navigation: left and right arrow buttons (40px × 40px, semi-transparent dark background, White icon) on each side of the image. On mobile: swipe left/right with no visible arrow buttons. A close button (×) in the upper-left corner. Escape key closes on desktop. All lightbox controls are keyboard and screen-reader accessible.

**Gallery limits by tier:**
- Free: 6 images maximum. After 6, no additional images render even if submitted.
- Standard and Premium: 12 images maximum.

**Empty state:** The Media section is hidden entirely from the public page when no images have been uploaded. No "No photos yet" empty state is shown to visitors.

### 8.2 Portfolio Gallery (Professional / Creative)

**Background:** Deep Background (`#19191E`).

**Layout:** A full-width feature image at the top (the first portfolio image, displayed at maximum content width, maintaining its aspect ratio, maximum 400px height). Below the feature image, a 3-column grid on desktop / 2-column on mobile of remaining portfolio images. All images are square-cropped.

The feature image treatment is intentionally more impactful than the business gallery — for a creative, the portfolio image is the primary credibility signal.

**Lightbox:** Identical behavior to Section 8.1.

### 8.3 Job Pages — No Media Section

Job Pages do not have a Media section. This section is suppressed entirely for the Job entity type.

---

## 9. Trust Section

### 9.1 Trust Badge Visual Specifications

Badges appear in two contexts: small (in the hero overlay and on listing cards in search results) and standard (in the Trust section and Quick Action Bar).

**Small badge dimensions (hero + listing cards):** Pill shape, 26px height, auto width. 8px horizontal padding. Font: Lato Regular 12px.

**Standard badge dimensions (Trust section):** Pill shape, 32px height, auto width. 12px horizontal padding. Font: Lato Regular 14px.

**Tier specifications:**

| Tier | Background | Text color | Border | Icon | Text |
|---|---|---|---|---|---|
| Unclaimed | `#595758` (Charcoal) | `#FFFFFF` White | None | None | "Unclaimed" |
| Claimed | `#3B82F6` (Blue) | `#FFFFFF` White | None | Checkmark icon 12px White | "Claimed" |
| Verified (V1) | `#D4A017` (muted gold) | `#000000` Brand Black | None | Checkmark icon 12px Brand Black | "Verified" |
| BLACQList Certified (V1) | `#E2A428` (Amber Gold) | `#000000` Brand Black | None | Star icon 12px Brand Black | "BLACQList Certified" |

**Important color note:** The BLACQList Certified badge uses Amber Gold as a background with Brand Black text — the only instance where Amber Gold is used as a background color that is not a CTA button. This is intentional: Certified is the highest earned status and the visual intensity of the full Amber Gold background communicates its significance. Do not add this treatment to any other badge tier.

**Featured / Sponsored badge (separate system from trust badges):**
- Amber Gold `#E2A428` outlined pill: 1.5px Amber Gold border, transparent background, Amber Gold text, optional star or bolt icon in Amber Gold.
- Size: same dimensions as trust badge at the same context (small for listing cards, standard for the Page itself).
- Label: "Featured" or "Sponsored" depending on placement type.
- Position on BLACQList Page: upper-right of the hero image (opposite corner from the trust badge which is upper-left). This separation prevents visual confusion between earned trust status and paid placement.
- Position on listing cards in search results: upper-right corner of the card image thumbnail.
- The outlined (not filled) treatment visually distinguishes Sponsored/Featured badges from trust tier badges at a glance.

### 9.2 Trust Section Layout

**Background:** Pale Lavender (`#E9E9F7`).

**Section heading:** "Trust & Verification" in Glacial Indifference Bold 28px Brand Black.

**Primary badge display:** The current trust tier badge at standard size (32px height), displayed prominently. Below the badge, a one-line description of what the tier means in plain language:
- Unclaimed: "This page has not yet been claimed by the owner."
- Claimed: "The business owner has claimed and verified this page."
- Verified (V1): "This entity has been verified by The BLACQList team."
- BLACQList Certified (V1): "This entity has completed The BLACQList certification program."

The description text is in Quicksand Bold Italic 15px Charcoal.

**"What this means" expand:** Below the description, an Amber Gold "Learn more about verification →" text link that opens a modal or navigates to a help article explaining the trust tier system.

**Verification date (Verified and Certified tiers, V1):** Below the description, in Lato Regular 13px Charcoal: "Verified [Month Year]".

**Reviews summary (V1):** Star rating display (5-star icon row, partially filled to the average, Amber Gold for filled stars, Pale Lavender for empty) + count: "4.2 out of 5 (38 reviews)". Clicking navigates to the Community Connection section.

**"Earn the Verified badge" CTA (shown on Claimed pages, V1):** A ghost/outline Amber Gold button: "Get Verified →" positioned after the trust badge and description.

### 9.3 Unclaimed Page Trust Prompt

On Unclaimed pages, two separate prompts appear — one in the Trust section and one immediately below the hero (just above or within the At-a-Glance section).

**Prompt visual treatment:** A Pale Lavender background band (full-width, within the section's background rhythm), 16px vertical padding, containing the text: "Own this business? Claim your free BLACQList Page." in Quicksand Bold Italic 15px Brand Black, followed by a "Claim This Page" Amber Gold button (small, 36px height, auto width).

**Positioning rules:** This prompt is present but not dominant. It should not be confused with a primary CTA. The entity's own CTA, name, and story receive visual priority. The claim prompt is a secondary element — readable but not competing.

---

## 10. Community Connection Section

### 10.1 Reviews Display (V1)

**Background:** White (`#FFFFFF`).

**Section heading:** "Community Reviews" in Glacial Indifference Bold 28px Brand Black. Count as a sub-heading in Lato Regular 16px Charcoal: "[N] reviews".

**Review card:** Pale Lavender (`#E9E9F7`) background, 1px Pale Lavender border, 8px border radius, 24px padding.

Card contents (top to bottom):
- Reviewer display name: Lato Regular 15px Brand Black (left), review date: Lato Regular 13px Charcoal (right)
- Star rating: 5-star row, Amber Gold filled stars, Pale Lavender empty stars. 16px star size.
- Review text: Quicksand Bold Italic 15px Brand Black, line height 1.6
- Owner response (if any): indented 16px from left with a thin 2px left border in Amber Gold, response text in Quicksand Bold Italic 14px Charcoal, "Response from [Entity Name]" as a label in Lato Regular 12px Charcoal above the response text

**Default display:** First 3 reviews. "Show all [N] reviews" Amber Gold expand link below the third card. Expand loads remaining reviews in place (no navigation away).

**Review card grid:** Single column on mobile, single column on desktop (reviews are text-heavy; a grid would make them too narrow).

### 10.2 Reviews MVP Placeholder

At MVP, the Community Connection section renders the following placeholder instead of review cards:

Section heading: "Community Reviews" in Glacial Indifference Bold 28px Brand Black.

If zero review submissions exist: body text in Quicksand Bold Italic 15px Charcoal: "Reviews are coming soon. Be part of the first wave when we launch." No count, no card, no action button.

If at least one review submission exists (even if unpublished): "[N] reviews submitted — watch this space." in Quicksand Bold Italic 15px Charcoal. The count is factual and creates anticipation without misleading visitors.

### 10.3 Write a Review CTA

Visible only to authenticated supporters on Claimed listings. Position: below the review cards or placeholder text. "Write a Review" Amber Gold button, standard size. Hidden for unauthenticated users and on Unclaimed listings.

### 10.4 Community Corrections Prompt (Beta)

A small, low-prominence row at the very bottom of the Community Connection section: "See something wrong?" in Lato Regular 14px Charcoal, followed by a "Report an issue" text link in Amber Gold. No icon, no background treatment, no card. This is the most visually quiet element on the page — it invites community maintenance without cluttering the experience.

---

## 11. Platform Activity Section

### 11.1 Save Count

**Background:** Cream (`#FCFAF4`).

**Display format:** Heart/bookmark icon (14px, Charcoal) + "[N] people saved this page" in Lato Regular 14px Charcoal. This is a single inline sentence — not a card, not a metric block. It lives as one line of social proof text.

**Threshold:** This line is only rendered when the save count is greater than 0. When a page has zero saves, this element does not appear. There is no "Be the first to save this page" prompt — the absence of the save count is simply the absence of the element.

**Position within the section:** Centered on desktop, left-aligned on mobile.

### 11.2 Collection Appearances (V1)

**Display format:** Below the save count, a "Featured in:" label in Lato Regular 13px Charcoal, followed by up to 3 collection links rendered as Amber Gold text links with an arrow: "Atlanta's Best Barbershops →". Each collection link is on its own line. Maximum 3 collections shown; if more exist, "and [N] more collections" as a non-linked text in Charcoal.

**Visibility:** Hidden entirely if the page appears in no published collections.

### 11.3 View Count — Owner Only

**Critical design rule:** The page view count is owner-only data. It must never appear on the public BLACQList Page. It lives exclusively in the owner dashboard's stats row. This rule is documented here to prevent it from being inadvertently added to the public Page during implementation. Any design that surfaces view counts on the public Page is incorrect.

---

## 12. Related Discovery Section

### 12.1 Layout

**Background:** Pale Lavender (`#E9E9F7`).

**Section heading:** Glacial Indifference Bold 24px Brand Black. Phrasing varies by entity type (see 12.2).

**Desktop:** A 3-column card grid with 16px gaps. Cards are identical to listing cards used in search results and discovery pages. Each card: cover image (16:9 aspect ratio), entity name in Glacial Indifference Bold 15px Brand Black, category in Lato Regular 13px Charcoal, city in Lato Regular 13px Charcoal, trust badge (small variant) in the lower-left of the card image. Save icon button in the upper-right corner of the card image.

**Mobile:** A horizontal scroll row with snap scrolling. Cards are 240px wide, fixed, with 12px gap between cards. The row scrolls on touch swipe. The end of the row has a 24px fade-out gradient to indicate more cards exist off-screen. No navigation arrows on mobile.

**Visibility:** The Related Discovery section is hidden entirely if fewer than 3 related listings exist. The section does not render a partial row or an empty state.

### 12.2 Entity-Type Heading Variants

| Entity type | Section heading |
|---|---|
| Business | "More [Category] in [City]" (e.g., "More Hair Salons in Atlanta") |
| Professional | "More [Profession Type] in [City]" (e.g., "More Attorneys in Atlanta") |
| Creative | "More [Medium/Genre] Creatives in [City]" |
| Event | Two headings stacked: "More events from [Organizer Name]" and "More events in [City]" — each with their own card row |
| Job | "More jobs at [Employer Name]" and "More jobs in [City]" — two separate rows |
| Vendor | "More from [Vendor Name]" (their other product categories) and "More vendors in [City]" |

When two rows are shown (Event, Job, Vendor), each row has its own heading and its own 3-card set. The two rows are stacked vertically with 32px between them.

---

## 13. Premium vs Free Page Differences

| Feature | Free | Standard | Premium |
|---|---|---|---|
| Hero image width | Constrained within 960px content container; page background visible on sides | Constrained within 960px content container | Full-bleed viewport-width, edge-to-edge |
| Hero image height (desktop) | 360px max | 400px max | 560px max |
| Hero corner radius | 12px top corners | 12px top corners | None (full bleed) |
| Gradient overlay | Present | Present | Present (same spec) |
| Gallery image limit | 6 images | 12 images | 12 images |
| Featured badge eligibility | Not eligible | Not eligible | Eligible (if purchased) |
| Sponsored placement eligibility | Not eligible | Not eligible | Eligible (if purchased) |
| Logo display | Yes | Yes | Yes |
| Cover image | Yes | Yes | Yes |
| All 10 sections | Yes | Yes | Yes |
| Owner analytics access | Basic (7-day window, MVP dashboard stats only) | Standard (30-day window) | Enhanced (90-day window + weekly trends) |
| Visual badge on Page | None (no tier indicator shown to visitors) | None | None — tier is an owner benefit, not a public label |

**Design rule:** Listing tier is never shown to visitors on the public Page. Visitors should not be able to identify whether a listing is Free, Standard, or Premium. The tier affects the design dimensions (hero bleed, gallery count) but is not labelled anywhere on the public Page.

---

## 14. Sponsored and Featured Badge Design

### 14.1 Featured Badge (on BLACQList Page)

The Featured badge indicates that a Premium-tier business has purchased featured placement. It is a transparency signal — it tells visitors that placement was paid for, so it must be visually distinguishable from trust tier badges.

**Visual spec:**
- Shape: pill, same dimensions as trust badges (small: 26px height; standard: 32px height)
- Background: transparent
- Border: 1.5px Amber Gold (`#E2A428`)
- Text: "Featured" in Amber Gold Lato Regular 12px (small) / 14px (standard)
- Icon: lightning bolt or star icon in Amber Gold, 12px — must be a different icon than the star used for BLACQList Certified. Recommended: use a bolt icon for Featured, reserve the star icon for Certified.
- Position on BLACQList Page hero: upper-right corner of the hero image area, 16px from the top and right edges. This is the opposite corner from the trust badge (upper-left). The two badges must never occupy the same corner.

**Accessibility requirement:** The Featured badge must include a `title` attribute or `aria-label` stating: "Featured placement — this business paid for featured visibility on The BLACQList." This ensures the signal is communicated to screen reader users.

### 14.2 Sponsored Badge (in Search Results / Discovery)

When a Premium listing has purchased sponsored placement in discovery and search results, the listing card shows a Sponsored badge on the card thumbnail.

**Visual spec:** Same as Featured badge above (outlined Amber Gold pill), but with the label "Sponsored" instead of "Featured".

**Position on listing cards:** Upper-right corner of the card's cover image thumbnail. The trust badge (if any) is in the lower-left of the card image — these two badges never occupy the same position.

**Design constraint:** The Sponsored badge must not imply higher trustworthiness than an unsponsored listing. Its outlined (not filled) treatment and its "Sponsored" label are the design mechanisms for this — an outlined badge reads as a tag, not a credential.

---

## 15. Mobile Layout — 375px Viewport

The following defines each section's specific behavior at 375px viewport width.

**Hero section (Business / Vendor):**
Full-bleed image (375px width). Image height: 240px. Entity name and CTA overlay the bottom of the image within the gradient. On mobile, the hero layout stacks: image fills the top 240px; entity name sits in the bottom 80px of the image over the gradient in 28px Glacial Indifference Bold White; tagline is hidden to save vertical space; primary CTA button is full-width below the entity name, also within the image or immediately below it in a constrained bar. Trust badge at upper-left (12px margin). Save + Share as icon buttons to the right of the CTA button or below it in a small flex row.

**Quick Action Bar:**
Fixed to viewport bottom. 56px height. Primary CTA fills approximately 55% of width. Remaining space divided evenly among 2–4 icon buttons (Phone, Map, Save, Share). No labels on icon buttons. Amber Gold primary CTA with Brand Black text.

**At-a-Glance:**
Stacked vertical list. Each item occupies one full row: icon (16px) + label text in Lato Regular 14px on a single line. 12px between each row. Horizontal rule separates At-a-Glance from the section above. No horizontal row layout — all items stack.

**Story section:**
Full-width text block, 16px horizontal padding, same expand/collapse behavior. Reading width approximately 343px — this is acceptable for body text at 15px.

**Services list:**
Single column, full-width rows. Service name on one line, description below (if provided), price right-aligned on the name line. 

**Media gallery:**
The featured large image is rendered full-width (375px × 240px). Remaining gallery images in a 2-column grid below (each image approximately 180px × 180px square). "View all photos" link below the grid.

**Trust section:**
Stacked: badge centered, description text centered, expand link below.

**Community Connection:**
Full-width review cards stacked in single column.

**Related Discovery:**
Horizontal scroll row. Cards 240px × 320px, left edge of first card at 16px from viewport edge. Row scrolls horizontally. Fade gradient at right edge.

**Typography adjustments for mobile:** All font sizes follow the mobile column in the typography scale table (Section 2.3). No additional adjustments needed beyond those defined.

---

## 16. Accessibility Requirements

The following requirements apply to every BLACQList Page regardless of entity type or tier.

### 16.1 Heading Hierarchy

Every BLACQList Page must maintain a strict heading hierarchy:
- `h1`: Entity name (one per page, in the hero section)
- `h2`: Each major section heading ("About", "Services", "Photos", "Trust & Verification", "Community Reviews", "Related")
- `h3`: Sub-section headings within a section (service item names, individual review headings if used, collection names)

No heading level may be skipped. Do not use an `h3` where an `h2` has not been established first in the document flow.

### 16.2 Image Alt Text

| Image | Alt text rule |
|---|---|
| Cover image | "[Entity name] — cover photo" as the default. If the owner provides a description during upload, use that instead. |
| Gallery images | "[Entity name] — photo [n]" as the default (e.g., "Reign Cuts — photo 3"). If the owner provides captions, use those. |
| Logo | "[Entity name] logo" |
| Portfolio images | Owner-provided title or "[Creative name] — portfolio piece [n]" |
| Product images | Product name as alt text |
| Trust badge icon | Decorative — `alt=""`. The badge text is the accessible label. |
| Decorative gradient overlays | CSS only — not `<img>` elements, so no alt text required |

### 16.3 Interactive Element Accessibility

**Primary CTA button:** Must be a semantic `<button>` or `<a>` element. Never a `<div>` or `<span>`. Must have explicit, descriptive label text matching the button's visible text. The button label alone — "Book Now", "Order Online" — must be sufficient to understand the action without surrounding context.

**Quick Action Bar phone link:** `<a href="tel:[number]">` with `aria-label="Call [Entity name]"`. The phone number as visible text is acceptable for sighted users; the aria-label adds entity context for screen reader users.

**Quick Action Bar map link:** `<a>` with `aria-label="Get directions to [Entity name]"`. Do not use "Map" as the label — "Get directions to" is more informative.

**Save button:** Dynamic `aria-label` that reflects save state. When unsaved: `aria-label="Save [Entity name]"`. When saved: `aria-label="Remove [Entity name] from saved"`. When auth prompt triggers: `aria-label="Sign in to save [Entity name]"`. The button must not rely solely on the filled/unfilled icon state to communicate its current meaning.

**Share button:** `aria-label="Share [Entity name]"`.

**Gallery "View all photos" link:** `aria-label="View all [N] photos of [Entity name]"`.

**Gallery lightbox:** When the lightbox opens, focus must be trapped within it. The first focused element inside the lightbox is the close button. Arrow key navigation between images. `Escape` closes. On close, focus returns to the "View all photos" trigger that opened the lightbox. Each image in the lightbox must have the same alt text rules as defined in 16.2.

### 16.4 Trust Badge Accessibility

Trust badges communicate status through both color and text. To ensure accessibility:
- The badge text ("Unclaimed", "Claimed", "Verified", "BLACQList Certified") is always visible — status is never communicated by color alone.
- The badge container should have `role="status"` to indicate to screen readers that this is a meaningful status label.
- Icons within badges (checkmark, star) are decorative and marked `aria-hidden="true"`. The badge text provides the accessible meaning.

### 16.5 Color Contrast Constraints

| Color combination | Contrast ratio | Use allowed |
|---|---|---|
| White text on Deep Background `#19191E` | Passes WCAG AA at all sizes | Yes — use freely |
| Brand Black text on White | Passes WCAG AAA | Yes — use freely |
| Brand Black text on Cream `#FCFAF4` | Passes WCAG AAA | Yes — use freely |
| Brand Black text on Pale Lavender `#E9E9F7` | Passes WCAG AA | Yes |
| Brand Black text on Amber Gold `#E2A428` (button label) | Passes WCAG AA at 16px+ | Yes — use only on CTA buttons at 16px or larger |
| Amber Gold text on White | Fails WCAG AA at body text sizes | NEVER use as body text. Use only for action links at 14px+ with bold weight, or for prices and metadata at 14px+. |
| Amber Gold text on Cream `#FCFAF4` | Fails WCAG AA at small sizes | Use only for action links at 14px Bold or larger. Not for body copy or fine print. |
| Charcoal `#595758` text on White | Passes WCAG AA | Yes — use for metadata and secondary labels |
| White text on Charcoal `#595758` badge | Passes WCAG AA | Yes — Unclaimed badge |
| White text on Blue `#3B82F6` badge | Passes WCAG AA | Yes — Claimed badge |
| Brand Black text on Amber Gold badge (Certified) | Passes WCAG AA | Yes — BLACQList Certified badge only |

**Enforcement rule:** Amber Gold as a text color on any light surface (White, Cream, Pale Lavender) is acceptable only for interactive text elements (links, expand toggles, prices, action labels) at 14px Bold or larger. It must never appear as body copy or fine print. Every design using Amber Gold text must be checked against this constraint before implementation.

### 16.6 Dynamic Content and Live Regions

**Reviews list (V1):** When additional reviews are loaded via the "Show all reviews" expand, the container that receives the new content must have `aria-live="polite"` so screen readers announce the update.

**Save button state change:** The `aria-label` change on the save button after a save/unsave action is communicated to screen readers because `aria-label` changes on a `<button>` are announced by most screen readers when the button is focused.

**Quick Action Bar visibility:** The bar's appearance and disappearance are CSS-driven transitions, not content removal. The bar element is always in the DOM — it is made visually hidden and removed from the tab order when not active using `visibility: hidden` and `tabindex="-1"`, not `display: none`, so the transition is smooth.

---

## 17. Phase Summary for BLACQList Page Design

This table summarizes which sections and features are active in each phase of the product roadmap.

| Feature / Section | MVP | Beta | V1 | V2 |
|---|---|---|---|---|
| Business Page (all 10 sections) | Active | — | — | — |
| Professional Page template | — | Active | — | — |
| Creative Page template | — | Active | — | — |
| Event Page template | — | Active | — | — |
| Job Page template | — | Active | — | — |
| Vendor Page template (full) | — | — | Active | — |
| Product sub-page | — | — | — | Active |
| Service sub-page | — | — | Active | — |
| Trust: Unclaimed badge | Active | — | — | — |
| Trust: Claimed badge | Active | — | — | — |
| Trust: Verified badge | — | — | Active | — |
| Trust: BLACQList Certified badge | — | — | Active | — |
| Reviews display | — | — | Active | — |
| Reviews submission | — | — | Active | — |
| Owner responses to reviews | — | — | Active | — |
| Community corrections prompt | — | Active | — | — |
| Collection appearances | — | — | Active | — |
| Save count display | Active | — | — | — |
| Named services with pricing | Active | — | Enhanced | — |
| Video embeds in Media | — | — | Active | — |
| Product grid | — | — | — | Active |
| Marketplace "Add to Cart" | — | — | — | Active |
| Featured / Sponsored badge | Active (design only) | — | Active (purchasable) | — |
| Premium full-bleed hero | Active | — | — | — |

---

*This document is the design direction source of truth for BLACQList Pages. All mockups, prototypes, and frontend implementations of BLACQList Pages must reference this document. Changes to any design decision in this document require version notation and must be communicated to frontend engineering and QA before implementation changes are made.*
