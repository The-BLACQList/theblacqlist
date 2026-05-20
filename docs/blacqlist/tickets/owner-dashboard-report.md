# Owner Dashboard — Build Report

**Date:** 2026-05-11
**Status:** Complete — pnpm tsc and pnpm lint both pass with zero errors.

---

## Routes Created

| Route                                   | File                                                | Description                                                                                       |
| --------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/dashboard`                            | `app/dashboard/layout.tsx` + `page.tsx`             | Layout with ownership guard; overview with listing card, completeness checklist, quick-edit links |
| `/dashboard/pages`                      | `app/dashboard/pages/page.tsx`                      | Owned pages list with status badge, last-saved timestamp, preview + edit links                    |
| `/dashboard/pages/[entityId]`           | `app/dashboard/pages/[entityId]/page.tsx`           | Redirects to `/edit`                                                                              |
| `/dashboard/pages/[entityId]/edit`      | `app/dashboard/pages/[entityId]/edit/page.tsx`      | Full page editor — six independent save sections                                                  |
| `/dashboard/pages/[entityId]/offerings` | `app/dashboard/pages/[entityId]/offerings/page.tsx` | Services list + add form                                                                          |
| `/dashboard/pages/[entityId]/media`     | `app/dashboard/pages/[entityId]/media/page.tsx`     | Photo grid with delete/alt-text; upload stubbed                                                   |
| `/dashboard/pages/[entityId]/analytics` | `app/dashboard/pages/[entityId]/analytics/page.tsx` | Lifetime counts (views, saves, reviews) + placeholder for chart data                              |

---

## Editable Fields by Section

### Basic info (`BasicInfoSection.tsx`)

- `listings.name` (max 200)
- `listings.tagline` (max 140)

### Story (`AboutSection.tsx`)

- `listing_details_business.description` (character counter, no hard limit enforced client-side)

### Contact & location (`ContactSection.tsx`)

- `listing_details_business.phone`
- `listing_details_business.email`
- `listing_details_business.website_url`
- `listing_details_business.address_line_1`
- `listing_details_business.address_line_2`
- `listing_details_business.state`
- `listing_details_business.zip`

### Social links (`SocialSection.tsx`)

- `listing_details_business.social_instagram`
- `listing_details_business.social_facebook`
- `listing_details_business.social_linkedin`
- `listing_details_business.social_tiktok`
- `listing_details_business.social_youtube`
- `listing_details_business.social_twitter`

### CTA (`CtaSection.tsx`)

- `listing_details_business.cta_type` (select from 18 valid types)
- `listing_details_business.cta_url` (required unless type = "call")
- `listing_details_business.cta_label_override` (optional, max 50 chars)

### SEO (`SeoSection.tsx`)

- `listings.meta_title` (max 60, warns amber at 55)
- `listings.meta_description` (max 160, warns amber at 150)

### Offerings (`OfferingsList.tsx` + `AddOfferingForm.tsx`)

- `services.name` (required, max 200)
- `services.description` (optional)
- `services.price_display` (optional text, e.g. "$75")
- `services.is_featured` (checkbox)

### Media (`MediaGrid.tsx`)

- `media_attachments.alt_text` (inline edit, max 200 chars)
- Delete: DB row deleted first, then Supabase Storage path removed (best-effort)
- Upload: stubbed (placeholder shown)

---

## Protected Fields (never exposed to owners)

These fields do not appear in any owner form:

- `listings.status` — admin-only
- `listings.trust_tier` — admin-only
- `listings.owner_user_id` — admin-only
- `listings.admin_notes` — admin-only
- `listings.moderation_notes` — admin-only
- `listings.is_featured` — admin-only
- `listings.is_sponsored` — admin-only
- `listings.flag_status` — admin-only
- `listings.noindex` — admin-only
- `listings.sitemap_include` — admin-only
- `listings.verification_status` — admin-only (owner cannot self-verify)
- `listings.verified_at` / `verified_by` — admin-only

---

## Permission Logic

### Layout guard (`app/dashboard/layout.tsx`)

`requireOwner()` in `lib/dashboard/guard.ts`:

1. `supabase.auth.getUser()` → redirects to `/sign-in?next=/dashboard` if not authenticated
2. Queries `listings WHERE owner_user_id = user.id AND deleted_at IS NULL` → redirects to `/account` if no owned listing found

### Per-page ownership verification (all edit routes and server actions)

- Every server action re-fetches the listing using the **authenticated client** with `WHERE owner_user_id = owner.user.id`
- If the listing is not found or not owned, returns `{ error: "..." }` — never exposes data from other owners
- RLS provides the database-level enforcement layer on top of this application-layer check

### Services ownership chain

- Service actions fetch `services JOIN listings` and verify `listings.owner_user_id = user.id` via a secondary query
- Double-checked at both the join layer and the explicit ownership query

---

## Moderation Decision: Immediate Publish

Owner edits publish immediately for all safe fields. There is no pending review step for owner content updates.

**Rationale:** Reducing friction for verified/claimed owners is the highest-priority UX goal for the MVP dashboard. Admin-only fields (`status`, `trust_tier`, `is_featured`, etc.) are never touched by owner actions, so a published listing stays published through all owner edits.

**What this means in practice:**

- A published page is revalidated immediately when an owner saves (`revalidatePath` called inside each action when `listing.status === 'published'`)
- `listings.last_edited_by_owner_at` is updated on each save for admin visibility
- `listings.status` is never changed by any owner action — only admins change status

---

## Files Created

### Auth / Guards

- `lib/dashboard/guard.ts` — `requireOwner()` (redirects) + `getOwnerSession()` (returns null)

### Server Actions

- `lib/actions/dashboard/updateListingContent.ts` — basic info + story + contact + social + SEO
- `lib/actions/dashboard/updateCta.ts` — CTA type, URL, label override
- `lib/actions/dashboard/addService.ts` — insert new service with auto display_order
- `lib/actions/dashboard/updateService.ts` — update name/description/price/is_featured
- `lib/actions/dashboard/deleteService.ts` — ownership-verified hard delete
- `lib/actions/dashboard/deleteMedia.ts` — DB delete + storage remove (best-effort)
- `lib/actions/dashboard/updateMediaAltText.ts` — alt text update

### UI Components

- `components/dashboard/DashboardSidebar.tsx` — dark sidebar with global + contextual nav
- `components/dashboard/BasicInfoSection.tsx` — name + tagline form
- `components/dashboard/AboutSection.tsx` — description textarea with char counter
- `components/dashboard/ContactSection.tsx` — phone, email, website, address fields
- `components/dashboard/SocialSection.tsx` — 6 social URL fields
- `components/dashboard/CtaSection.tsx` — CTA type select + conditional URL + label override
- `components/dashboard/SeoSection.tsx` — meta_title + meta_description with char counters
- `components/dashboard/OfferingsList.tsx` — inline edit/delete for services
- `components/dashboard/AddOfferingForm.tsx` — add service form (resets on success)
- `components/dashboard/MediaGrid.tsx` — photo grid with delete overlay, alt-text inline edit, upload placeholder

### Routes

- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/pages/page.tsx`
- `app/dashboard/pages/[entityId]/page.tsx`
- `app/dashboard/pages/[entityId]/edit/page.tsx`
- `app/dashboard/pages/[entityId]/offerings/page.tsx`
- `app/dashboard/pages/[entityId]/media/page.tsx`
- `app/dashboard/pages/[entityId]/analytics/page.tsx`

---

## Next Ticket Recommendations

### Immediate (blocks dashboard utility)

1. **Upload flow** — Supabase Storage bucket `listing-media` must be confirmed provisioned + RLS policy for authenticated uploads. Then replace the stub in `MediaGrid.tsx` with a real file input pointing to a `/api/media/upload` route handler.
2. **`/dashboard` link in public header** — Signed-in owners see no link to their dashboard. Add conditional "Dashboard" link in `PublicHeader` when `user.user_metadata.has_listing` is set, or check via an API route.

### High value

3. **Hours editor** — `listing_details_business.hours` (JSONB) is not yet editable. Needs a day-of-week + open/close time UI.
4. **Logo / cover photo upload** — `listings.logo_path` and `listings.cover_image_path` are not managed from the dashboard.
5. **Offerings reorder** — `display_order` is set on insert but there is no drag-to-reorder UI yet.

### Later

6. **Real analytics** — Connect page view events from `analytics_events` table to the analytics page with a 7-day chart.
7. **Mobile sidebar** — Desktop sidebar is visible on all screen sizes. Mobile needs a collapsible drawer.
8. **Claim status UI** — Show trust_tier badge and instructions for unclaimed owners to submit a claim from within the dashboard.
