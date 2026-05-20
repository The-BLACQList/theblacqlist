# Enums and Statuses — The BLACQList

**Product:** The BLACQList
**Database:** Supabase / PostgreSQL
**Date:** 2026-05-07
**Status:** Approved — pre-migration reference
**Audience:** Engineers writing database migrations, CHECK constraints, and zod validation schemas
**Linked data model:** `docs/blacqlist/data/data-model.md`
**Linked content model:** `docs/blacqlist/data/entity-content-model.md`

This document is the authoritative reference for every enum-like field across the platform. Every value set listed here must be replicated in three places: the PostgreSQL CHECK constraint, the zod schema, and the TypeScript `const` or `enum` type. When a new value is added, update all three.

---

## 1. Entity Type Values

**Table:** `listings`
**Column:** `entity_type`
**Constraint:** `CHECK (entity_type IN ('business','professional','creative','event','job','vendor'))`
**Set on:** CREATE. Never changed after first publish.
**Zod:** `z.enum(['business','professional','creative','event','job','vendor'])`

| Value          | Description                                                                        | Extension Table                                       | Phase    |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| `business`     | Standard commercial business, brick-and-mortar or online                           | `listing_details_business`                            | **MVP**  |
| `professional` | Individual professional: attorney, therapist, coach, financial advisor, trainer    | `listing_details_professional`                        | **Beta** |
| `creative`     | Individual or studio creative: artist, musician, designer, photographer, filmmaker | `listing_details_creative`                            | **Beta** |
| `event`        | Time-bounded event: concert, pop-up market, workshop, conference                   | `listing_details_event`                               | **Beta** |
| `job`          | Job opportunity posting; auto-expires at deadline                                  | `listing_details_job`                                 | **Beta** |
| `vendor`       | Physical or digital product seller; extends business with `listing_details_vendor` | `listing_details_business` + `listing_details_vendor` | **V2**   |

---

## 2. Status Values

### 2.1 `listings.status`

**Constraint:** `CHECK (status IN ('draft','pending','published','unpublished','flagged','archived'))`
**Default:** `'draft'`
**Zod:** `z.enum(['draft','pending','published','unpublished','flagged','archived'])`

| Value         | Meaning                                                 | Public Visible | Search Indexed | Sitemap |
| ------------- | ------------------------------------------------------- | -------------- | -------------- | ------- |
| `draft`       | Owner editing; not submitted for review                 | No             | No             | No      |
| `pending`     | Submitted for admin review (community-sourced listings) | No             | No             | No      |
| `published`   | Live and indexable                                      | Yes            | Yes            | Yes     |
| `unpublished` | Owner took it offline                                   | No             | No             | No      |
| `flagged`     | Admin flagged for review; hidden from public            | No             | No             | No      |
| `archived`    | Auto-archived (expired event/job) or admin-archived     | No             | No             | No      |

**State machine:**

```
draft → [owner submits] → pending (owner, system)
draft → [owner publishes directly — owner-created listings] → published (owner)
pending → [admin approves] → published (admin)
pending → [admin rejects] → draft (admin — returns to owner with moderation_notes)
published → [owner unpublishes] → unpublished (owner)
published → [admin flags] → flagged (admin)
published → [auto_archive_at passes] → archived (scheduled function)
published → [auto_expire_at passes] → archived (scheduled function)
unpublished → [owner republishes] → published (owner)
flagged → [admin resolves flag] → published (admin)
flagged → [admin confirms removal] → unpublished (admin)
any non-archived → [admin archives] → archived (admin)
```

**Source routing rules:**

- `source = 'owner'`: listing starts as `draft`; owner can publish directly OR submit for review
- `source = 'community'`: listing starts as `pending`; requires admin approval before publishing
- `source = 'admin'`: listing starts as `draft`; admin publishes when ready
- `source = 'import'`: listing starts as `draft` unless import script sets `published` directly (requires super_admin)

---

### 2.2 `listings.trust_tier`

**Constraint:** `CHECK (trust_tier IN ('unclaimed','claimed','verified','certified'))`
**Default:** `'unclaimed'`
**Zod:** `z.enum(['unclaimed','claimed','verified','certified'])`

| Value       | Display Label       | Badge Color          | Meaning                                      | Phase Active |
| ----------- | ------------------- | -------------------- | -------------------------------------------- | ------------ |
| `unclaimed` | Unclaimed           | Gray                 | No owner has claimed this listing            | **MVP**      |
| `claimed`   | Claimed             | Blue                 | Owner identity confirmed via claims workflow | **MVP**      |
| `verified`  | Verified            | Green                | Owner submitted documents; admin-approved    | **V1**       |
| `certified` | BLACQList Certified | Amber Gold (#E2A428) | Auto-granted when all 5 criteria met         | **V1**       |

**State machine:**

```
unclaimed → [claim approved] → claimed (admin — via claims workflow)
claimed → [verification docs approved] → verified (admin — V1)
verified → [all 5 auto-grant criteria met] → certified (DB trigger — V1)
certified → [admin manual revoke] → verified (super_admin)
verified → [admin revokes docs] → claimed (super_admin)
claimed → [admin revokes claim] → unclaimed (super_admin)
```

**Auto-grant trigger for `certified` — all 5 conditions must be simultaneously true:**

| #   | Condition                                    | Source                                                                        |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `trust_tier = 'verified'`                    | `listings.trust_tier`                                                         |
| 2   | ≥ 6 published reviews for this listing       | `COUNT(*) FROM reviews WHERE listing_id = ? AND status = 'published'`         |
| 3   | Average published review rating ≥ 4.0        | `AVG(star_rating) FROM reviews WHERE listing_id = ? AND status = 'published'` |
| 4   | `listings.status = 'published'`              | `listings.status`                                                             |
| 5   | `published_at <= now() - interval '90 days'` | `listings.published_at`                                                       |

---

### 2.3 `listings.verification_status`

**Constraint:** `CHECK (verification_status IN ('none','pending','under_review','verified','rejected'))`
**Default:** `'none'`
**Zod:** `z.enum(['none','pending','under_review','verified','rejected'])`
**Phase:** Column built at MVP; workflow active at V1

| Value          | Meaning                                             | Who Sets           |
| -------------- | --------------------------------------------------- | ------------------ |
| `none`         | Never submitted for verification                    | Default; system    |
| `pending`      | Owner uploaded documents; awaiting admin            | Owner uploads docs |
| `under_review` | Admin has opened the submission                     | Admin              |
| `verified`     | Admin approved; `trust_tier` elevated to `verified` | Admin              |
| `rejected`     | Admin rejected; owner sees `verification_notes`     | Admin              |

**State machine:**

```
none → [owner uploads docs] → pending (owner)
pending → [admin opens submission] → under_review (admin)
under_review → [admin approves] → verified (admin) — also sets trust_tier = 'verified'
under_review → [admin rejects] → rejected (admin) — sets verification_notes
rejected → [owner resubmits] → pending (owner)
```

---

### 2.4 `listings.flag_status`

**Constraint:** `CHECK (flag_status IN ('none','inactive','duplicate','incorrect','spam'))`
**Default:** `'none'`
**Zod:** `z.enum(['none','inactive','duplicate','incorrect','spam'])`

| Value       | Meaning                                    | Impact on Listing                           | Who Sets                         |
| ----------- | ------------------------------------------ | ------------------------------------------- | -------------------------------- |
| `none`      | No flag; listing is clean                  | Normal visibility                           | System default; admin resolution |
| `inactive`  | Business appears closed or inactive        | Hidden from public search; `noindex = true` | Admin                            |
| `duplicate` | Another listing exists for the same entity | Hidden from public search; `noindex = true` | Admin                            |
| `incorrect` | Known incorrect information                | Hidden from public search; `noindex = true` | Admin                            |
| `spam`      | Fraudulent or promotional content          | Hidden from public search; `noindex = true` | Admin                            |

**Resolution path:** Any non-`none` value causes `status = 'flagged'` and `noindex = true`. Admin sets `flag_status = 'none'` to resolve; this triggers `noindex = false` and `status = 'published'` restoration (via application logic, not a DB trigger).

---

### 2.5 `claims.status`

**Constraint:** `CHECK (status IN ('pending','under_review','approved','rejected'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','under_review','approved','rejected'])`

| Value          | Meaning                                      | Who Sets                        |
| -------------- | -------------------------------------------- | ------------------------------- |
| `pending`      | Claim submitted; not yet reviewed            | Owner submit action             |
| `under_review` | Admin has opened the claim                   | Admin                           |
| `approved`     | Claim approved; `listings.owner_user_id` set | Admin — triggers listing update |
| `rejected`     | Claim denied                                 | Admin                           |

**State machine:**

```
pending → [admin opens] → under_review (admin)
under_review → [admin approves] → approved (admin)
  Side effect: listings.owner_user_id = claims.claimant_user_id
              listings.trust_tier = 'claimed'
              listings.claim_id = claims.id
under_review → [admin rejects] → rejected (admin)
rejected → [owner resubmits — new claim row] → pending (new row; old row stays rejected)
```

---

### 2.6 `reviews.status`

**Constraint:** `CHECK (status IN ('pending','approved','rejected','flagged'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','approved','rejected','flagged'])`
**Phase:** Schema at MVP; display and approval workflow at V1

| Value      | Meaning                                 | Public Visible                                    |
| ---------- | --------------------------------------- | ------------------------------------------------- |
| `pending`  | Submitted; awaiting admin approval      | No                                                |
| `approved` | Admin-approved; visible on listing Page | Yes                                               |
| `rejected` | Admin rejected (spam, fake, violation)  | No                                                |
| `flagged`  | Approved review reported by a user      | Depends — visible but under review until resolved |

**State machine:**

```
pending → [admin approves] → approved (admin)
  Side effect: triggers certification check on the associated listing
pending → [admin rejects] → rejected (admin)
approved → [user reports via review_reports] → flagged (system)
flagged → [admin dismisses report] → approved (admin)
flagged → [admin confirms violation] → rejected (admin)
```

---

### 2.7 `corrections.status`

**(Beta)**
**Constraint:** `CHECK (status IN ('pending','under_review','resolved','dismissed'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','under_review','resolved','dismissed'])`

| Value          | Meaning                                     | Who Sets  |
| -------------- | ------------------------------------------- | --------- |
| `pending`      | Correction submitted by community           | Submitter |
| `under_review` | Admin opened the correction                 | Admin     |
| `resolved`     | Correction applied to the listing           | Admin     |
| `dismissed`    | Admin dismissed as incorrect or unnecessary | Admin     |

**State machine:**

```
pending → [admin opens] → under_review (admin)
under_review → [admin applies] → resolved (admin) — applies suggested_value to listing field
under_review → [admin dismisses] → dismissed (admin)
```

---

### 2.8 `orders.status`

**(V2)**
**Constraint:** `CHECK (status IN ('pending','payment_processing','paid','fulfilling','shipped','delivered','completed','cancelled','refund_requested','refunded'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','payment_processing','paid','fulfilling','shipped','delivered','completed','cancelled','refund_requested','refunded'])`

| Value                | Meaning                                               |
| -------------------- | ----------------------------------------------------- |
| `pending`            | Order created; payment not yet initiated              |
| `payment_processing` | Stripe PaymentIntent created; awaiting confirmation   |
| `paid`               | Payment confirmed by Stripe webhook                   |
| `fulfilling`         | Vendor has acknowledged and is preparing order        |
| `shipped`            | Physical order shipped; tracking provided             |
| `delivered`          | Order confirmed delivered                             |
| `completed`          | Order finalized; payout triggered to vendor           |
| `cancelled`          | Order cancelled before payment or by mutual agreement |
| `refund_requested`   | Buyer requested refund                                |
| `refunded`           | Refund processed through Stripe                       |

**State machine:**

```
pending → [buyer initiates payment] → payment_processing (system)
payment_processing → [Stripe webhook: payment_succeeded] → paid (system)
payment_processing → [Stripe webhook: payment_failed] → cancelled (system)
paid → [vendor acknowledges] → fulfilling (vendor)
fulfilling → [vendor ships] → shipped (vendor/system)
shipped → [delivery confirmed] → delivered (system/buyer)
delivered → [auto after 7 days or buyer confirms] → completed (system/buyer)
paid | fulfilling | shipped → [mutual cancel] → cancelled (vendor + admin)
completed | delivered → [buyer requests refund] → refund_requested (buyer)
refund_requested → [admin approves Stripe refund] → refunded (admin)
```

---

### 2.9 `subscriptions.status`

**(V1)**
**Constraint:** `CHECK (status IN ('trialing','active','past_due','cancelled','paused'))`
**Default:** `'trialing'` (if trial offered) or `'active'` (if no trial)
**Zod:** `z.enum(['trialing','active','past_due','cancelled','paused'])`

| Value       | Meaning                                         | Who Sets       |
| ----------- | ----------------------------------------------- | -------------- |
| `trialing`  | In free trial period; payment method required   | Stripe webhook |
| `active`    | Subscription current; payment successful        | Stripe webhook |
| `past_due`  | Payment failed; Stripe retrying                 | Stripe webhook |
| `cancelled` | Subscription cancelled; access until period end | Owner or admin |
| `paused`    | Subscription paused; billing paused (V1.5)      | Owner or admin |

**State machine:**

```
[new subscription created] → trialing (if trial) OR active (if no trial)
trialing → [trial ends with successful payment] → active (Stripe)
active → [payment fails] → past_due (Stripe)
past_due → [payment retried successfully] → active (Stripe)
past_due → [all retries exhausted] → cancelled (Stripe)
active | trialing → [owner cancels] → cancelled (owner)
active → [admin pauses] → paused (admin — V1.5)
paused → [admin resumes] → active (admin)
```

---

### 2.10 `receipt_uploads.status`

**(V2)**
**Constraint:** `CHECK (status IN ('pending','confirmed','processed','rejected'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','confirmed','processed','rejected'])`

| Value       | Meaning                                   |
| ----------- | ----------------------------------------- |
| `pending`   | Image uploaded; OCR job queued or running |
| `confirmed` | User reviewed and confirmed OCR result    |
| `processed` | Spend event created from this receipt     |
| `rejected`  | User cancelled or OCR confidence too low  |

**State machine:**

```
[upload] → pending (system)
pending → [OCR completes; user confirms] → confirmed (user)
confirmed → [spend_event created] → processed (system)
pending → [user cancels or confidence < threshold] → rejected (user/system)
```

---

### 2.11 `ai_suggestions.status`

**(V2)**
**Constraint:** `CHECK (status IN ('pending','shown','acted_on','dismissed'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','shown','acted_on','dismissed'])`

| Value       | Meaning                           |
| ----------- | --------------------------------- |
| `pending`   | Generated; not yet shown to owner |
| `shown`     | Displayed in owner dashboard      |
| `acted_on`  | Owner applied the suggestion      |
| `dismissed` | Owner dismissed without acting    |

---

### 2.12 `ai_moderation_flags.status`

**(V2)**
**Constraint:** `CHECK (status IN ('pending','reviewed_safe','reviewed_actioned','dismissed'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','reviewed_safe','reviewed_actioned','dismissed'])`

| Value               | Meaning                                                       |
| ------------------- | ------------------------------------------------------------- |
| `pending`           | AI flagged content; awaiting human review                     |
| `reviewed_safe`     | Human reviewer found content acceptable                       |
| `reviewed_actioned` | Human reviewer took action (removed, edited, flagged listing) |
| `dismissed`         | Confidence score too low; auto-dismissed without human review |

---

### 2.13 `ai_agent_runs.status`

**(V3)**
**Constraint:** `CHECK (status IN ('queued','running','completed','failed','cancelled'))`
**Default:** `'queued'`
**Zod:** `z.enum(['queued','running','completed','failed','cancelled'])`

| Value       | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `queued`    | Run scheduled but not yet started                          |
| `running`   | Agent actively executing                                   |
| `completed` | Run finished successfully                                  |
| `failed`    | Run encountered an error; see `output_summary` for details |
| `cancelled` | Run cancelled before completion                            |

---

### 2.14 `editorial_articles.status` and `guides.status`

**Shared constraint:** `CHECK (status IN ('draft','in_review','published','archived'))`
**Default:** `'draft'`
**Zod:** `z.enum(['draft','in_review','published','archived'])`

| Value       | Meaning                                 | Who Sets     |
| ----------- | --------------------------------------- | ------------ |
| `draft`     | Being written; not visible to public    | Author       |
| `in_review` | Submitted for editorial review          | Author       |
| `published` | Live on site                            | Editor/admin |
| `archived`  | Removed from site; preserved for record | Admin        |

---

### 2.15 `verification_submissions.decision`

**(V1)**
**Constraint:** `CHECK (decision IN ('pending','approved','rejected'))`
**Default:** `'pending'`
**Zod:** `z.enum(['pending','approved','rejected'])`

| Value      | Meaning            | Effect                                                                                                          |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pending`  | Under admin review | `listings.verification_status = 'under_review'`                                                                 |
| `approved` | Documents accepted | `listings.verification_status = 'verified'`, `listings.trust_tier = 'verified'`, `listings.verified_at = now()` |
| `rejected` | Documents rejected | `listings.verification_status = 'rejected'`, `listings.verification_notes` set                                  |

---

## 3. Trust Tier Values (Detailed)

| Tier        | Badge Label           | Badge Color          | Criteria to Reach                     | Visible On Page                                         | Search Impact                                          |
| ----------- | --------------------- | -------------------- | ------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| `unclaimed` | "Unclaimed"           | Gray                 | Default state                         | Small badge in header                                   | None                                                   |
| `claimed`   | "Claimed by Owner"    | Blue (#4B6BFB)       | Approved claim in `claims` table      | Badge in header + trust section                         | Slight positive ranking signal                         |
| `verified`  | "Verified"            | Green (#22C55E)      | Admin-approved verification docs      | Prominent badge in hero                                 | Stronger ranking signal; filter eligibility            |
| `certified` | "BLACQList Certified" | Amber Gold (#E2A428) | All 5 auto-grant criteria (see below) | Premium badge treatment; hero + dedicated trust section | Highest ranking signal; featured placement eligibility |

**Auto-grant criteria for `certified` (all 5 simultaneously):**

| #   | Condition                                                                           |
| --- | ----------------------------------------------------------------------------------- |
| 1   | `trust_tier = 'verified'`                                                           |
| 2   | `COUNT(reviews WHERE listing_id = ? AND status = 'approved') >= 6`                  |
| 3   | `AVG(star_rating FROM reviews WHERE listing_id = ? AND status = 'approved') >= 4.0` |
| 4   | `listings.status = 'published'`                                                     |
| 5   | `listings.published_at <= now() - interval '90 days'`                               |

**Revocation paths:**

| Scenario                                         | Resulting Tier                                                  | Who Can Execute       |
| ------------------------------------------------ | --------------------------------------------------------------- | --------------------- |
| Admin manually revokes certification             | `verified`                                                      | `super_admin`         |
| Admin revokes verification docs                  | `claimed`                                                       | `super_admin`         |
| Admin revokes claim                              | `unclaimed`                                                     | `super_admin`         |
| Reviews fall below threshold after certification | No automatic change; certification is not automatically revoked | Admin action required |

---

## 4. Listing Tier Values

**Table:** `listings`
**Column:** `tier`
**Constraint:** `CHECK (tier IN ('free','standard','premium'))`
**Default:** `'free'`
**Zod:** `z.enum(['free','standard','premium'])`

| Value      | Phase Available | Gallery Limit | Analytics Access      | Search Placement   | Featured Eligibility        |
| ---------- | --------------- | ------------- | --------------------- | ------------------ | --------------------------- |
| `free`     | **MVP**         | 6 images      | None                  | Standard           | No                          |
| `standard` | **V1**          | 12 images     | 30-day summary        | Priority over free | Yes (editorial only)        |
| `premium`  | **V1**          | 12 images     | Full 365-day + export | Highest priority   | Yes (editorial + sponsored) |

**Tier is invisible to visitors.** It never appears on the public BLACQList Page. It affects search position, gallery capacity, and analytics access — not Page design or trust display.

---

## 5. Verification Status Values

**Table:** `listings`
**Column:** `verification_status`
**See Section 2.3 for full state machine.**

| Value          | Phase Active           | Workflow Stage             |
| -------------- | ---------------------- | -------------------------- |
| `none`         | **MVP** (column built) | Never submitted            |
| `pending`      | **V1**                 | Owner has uploaded docs    |
| `under_review` | **V1**                 | Admin reviewing            |
| `verified`     | **V1**                 | Approved                   |
| `rejected`     | **V1**                 | Denied; owner can resubmit |

---

## 6. User Role Values

**Table:** `user_roles`
**Column:** `role`
**Constraint:** `CHECK (role IN ('supporter','owner','editor','admin','super_admin'))`
**Zod:** `z.enum(['supporter','owner','editor','admin','super_admin'])`

| Role          | Description                                                              | Permissions Summary                                                                     | Who Can Assign             | Max Count                           |
| ------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| `supporter`   | General authenticated user; can search, save, review, submit corrections | Read published listings; manage own saves and reviews                                   | Self-assigned on signup    | Unlimited                           |
| `owner`       | Listing owner; has edit access to one or more listings                   | Read/write own listings; upload media; configure CTA; view own analytics                | Admin (via claim approval) | Unlimited (one per claimed listing) |
| `editor`      | Internal content editor; can edit any listing                            | Read/write all listings; manage collections; publish editorial articles                 | `admin` or `super_admin`   | Unlimited                           |
| `admin`       | Platform administrator; manages moderation queue and claims              | All editor permissions; approve/reject claims and reviews; manage users; run moderation | `super_admin` only         | Unlimited                           |
| `super_admin` | Highest privilege; unrestricted platform access                          | All permissions; manage admin users; revoke trust tiers; execute destructive operations | Manual (no UI)             | ≤ 2 active at any time              |

**Role assignment rules:**

- `supporter`: auto-assigned to every new `profiles` row on signup
- `owner`: assigned by admin when a claim is approved (not self-assignable)
- `editor`: assigned by admin or super_admin only
- `admin`: assigned by super_admin only
- `super_admin`: must be set directly in the database; no UI assignment path; maximum 2 active simultaneously

**RLS enforcement:** User role is checked by querying `user_roles` for the authenticated `auth.uid()`. Role-based RLS policies are additive — a user with `owner` role also retains `supporter` permissions.

---

## 7. Source Values

**Table:** `listings`
**Column:** `source`
**Constraint:** `CHECK (source IN ('owner','community','admin','import'))`
**Default:** `'owner'`
**Zod:** `z.enum(['owner','community','admin','import'])`

| Value       | Meaning                                      | Default Status on Create                    | Moderation Routing                                                      |
| ----------- | -------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| `owner`     | Business owner created listing directly      | `draft`                                     | Owner-controlled publish; admin review optional                         |
| `community` | Supporter submitted a listing for a business | `pending`                                   | Automatically added to moderation queue for admin review before publish |
| `admin`     | Internal admin created the listing           | `draft`                                     | Admin publishes when ready; no queue routing                            |
| `import`    | Seeded via bulk data import script           | `draft` (or `published` if import flag set) | Bulk review by admin post-import                                        |

---

## 8. Location Type Values

**Table:** `listings`
**Column:** `location_type`
**Constraint:** `CHECK (location_type IN ('physical','online','hybrid','virtual-services','ships-nationwide'))`
**Default:** `'physical'`
**Zod:** `z.enum(['physical','online','hybrid','virtual-services','ships-nationwide'])`

| Value              | Address Display                               | Map Link                         | City Filter Eligible                      | Phase   |
| ------------------ | --------------------------------------------- | -------------------------------- | ----------------------------------------- | ------- |
| `physical`         | Full address shown                            | Yes — Google Maps link generated | Yes                                       | **MVP** |
| `online`           | "Online Only" shown                           | No                               | No (unless city_id set for founding city) | **MVP** |
| `hybrid`           | Address shown + "Also serves online"          | Yes                              | Yes                                       | **MVP** |
| `virtual-services` | "Virtual Services" shown; no address          | No                               | Optional (professional's home city)       | **MVP** |
| `ships-nationwide` | "Ships Nationwide" shown; no address required | No                               | Yes (by founding city if set)             | **MVP** |

---

## 9. CTA Type Values

All 18 CTA types. Engineers use this table to implement CTA rendering logic. The `cta_type` field exists on `listing_details_business`, `listing_details_professional`, `listing_details_creative`, `listing_details_event`, `listing_details_job`, `listing_details_vendor`, and `services`.

| `cta_type`     | Default Label       | Applicable Entity Types          | Click Behavior                                   | `cta_url` Required              | Phase    |
| -------------- | ------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------- | -------- |
| `book`         | "Book Now"          | Business, Professional           | Opens `cta_url` in new tab                       | Yes                             | **MVP**  |
| `order`        | "Order Now"         | Business, Vendor                 | Opens `cta_url` in new tab                       | Yes                             | **MVP**  |
| `call`         | "Call Now"          | Business, Professional, Creative | `tel:` link using phone field                    | No (uses `phone` field)         | **MVP**  |
| `message`      | "Message Us"        | Business, Professional, Creative | Opens `cta_url` or `mailto:`                     | Yes (or phone)                  | **MVP**  |
| `visit`        | "Visit Us"          | Business                         | Opens `cta_url` or Google Maps                   | Yes (or generates from address) | **MVP**  |
| `get-quote`    | "Get a Quote"       | Business, Professional           | Opens `cta_url` or `mailto:`                     | Yes (or email)                  | **MVP**  |
| `subscribe`    | "Subscribe"         | Business, Creative               | Opens `cta_url`                                  | Yes                             | **MVP**  |
| `contact`      | "Contact"           | Creative, Professional           | Opens `cta_url` or `mailto:`                     | Yes (or email)                  | **MVP**  |
| `inquire`      | "Inquire"           | Professional, Creative           | Opens `cta_url` or `mailto:`                     | Yes (or email)                  | **MVP**  |
| `commission`   | "Commission Me"     | Creative                         | Opens `cta_url` or `mailto:`                     | Yes (or email)                  | **Beta** |
| `get-tickets`  | "Get Tickets"       | Event                            | Opens `ticket_url` or `cta_url` in new tab       | Yes                             | **Beta** |
| `rsvp`         | "RSVP"              | Event                            | Opens `rsvp_url` or `cta_url` in new tab         | Yes                             | **Beta** |
| `register`     | "Register"          | Event                            | Opens `cta_url` in new tab                       | Yes                             | **Beta** |
| `learn-more`   | "Learn More"        | Event, Job                       | Opens `cta_url` in new tab                       | Yes                             | **Beta** |
| `apply`        | "Apply Now"         | Job                              | Opens `apply_url` or `cta_url` in new tab        | Yes                             | **Beta** |
| `shop`         | "Shop Now"          | Vendor                           | Scrolls to storefront section or opens `cta_url` | No (scrolls on-page)            | **V2**   |
| `buy-now`      | "Buy Now"           | Product                          | In-platform cart (V2) or opens `cta_url`         | No (V2 in-platform)             | **V2**   |
| `book-service` | "Book This Service" | Service                          | Opens `cta_url` in new tab                       | Yes                             | **V1**   |

**CTA rendering rules:**

- `cta_label_override` on `listing_details_business` takes precedence over the default label when non-null
- `call` CTA: if `phone` is null, the CTA is not rendered; Page falls back to next available contact method
- `shop` CTA at MVP/Beta (before V2): if `cta_url` is null, button is hidden
- Every entity must have a valid `cta_type` before publishing — incomplete listing validation enforces this

---

## 10. Analytics Event Names

All 45 event names used in `analytics_events.event_name`.
**Constraint:** Enforced at application layer only (not a DB CHECK constraint — new event names added without migrations).
**Zod:** `z.enum([...all 45 values...])`

### MVP Events (29)

| Event Name                   | Trigger                                           | Applicable Entity Types          | Key Properties in `properties` jsonb                             |
| ---------------------------- | ------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------- | ------------------------------ | ---------- | ---------- | --------- | --------- | ----------- |
| `page_view`                  | Listing Page loaded                               | All                              | `{listing_id, entity_type, city_slug, referrer, is_preview}`     |
| `hero_cta_click`             | Hero CTA button clicked                           | All                              | `{listing_id, cta_type, cta_url}`                                |
| `save_toggled`               | Save button in hero                               | All                              | `{listing_id, direction: 'saved'                                 | 'unsaved'}`                    |
| `save_toggled_action_bar`    | Save button in sticky action bar                  | All                              | `{listing_id, direction: 'saved'                                 | 'unsaved'}`                    |
| `save_toggled_related`       | Save on a related listing card                    | All                              | `{listing_id, direction: 'saved'                                 | 'unsaved', source_listing_id}` |
| `share_initiated`            | Share button pressed                              | All                              | `{listing_id, share_method: 'copy_link'                          | 'native_share'                 | 'social'}` |
| `action_bar_cta_click`       | Sticky action bar CTA clicked                     | All                              | `{listing_id, cta_type}`                                         |
| `action_bar_phone_click`     | Phone number in action bar clicked                | Business, Professional, Creative | `{listing_id}`                                                   |
| `action_bar_map_click`       | Map link in action bar clicked                    | Business, Event                  | `{listing_id}`                                                   |
| `phone_click`                | Phone number in contact section clicked           | Business, Professional, Creative | `{listing_id}`                                                   |
| `website_click`              | Website URL clicked                               | All                              | `{listing_id, url}`                                              |
| `map_click`                  | Address/map link clicked                          | Business, Event                  | `{listing_id}`                                                   |
| `email_click`                | Email address clicked (mailto:)                   | All                              | `{listing_id}`                                                   |
| `social_link_click`          | Any social platform link clicked                  | All                              | `{listing_id, platform: 'instagram'                              | 'facebook'                     | 'tiktok'   | 'linkedin' | 'twitter' | 'youtube' | 'behance'}` |
| `story_expanded`             | "Read More" in story/about section                | All                              | `{listing_id}`                                                   |
| `story_collapsed`            | "Show Less" in story/about section                | All                              | `{listing_id}`                                                   |
| `services_expanded`          | Services section expanded                         | Business, Professional           | `{listing_id}`                                                   |
| `gallery_opened`             | Gallery lightbox opened                           | All                              | `{listing_id, image_index: 0}`                                   |
| `gallery_navigated`          | Gallery lightbox arrow/dot navigation             | All                              | `{listing_id, from_index, to_index}`                             |
| `gallery_closed`             | Gallery lightbox closed                           | All                              | `{listing_id}`                                                   |
| `trust_section_view`         | Trust and verification section scrolled into view | All                              | `{listing_id, trust_tier}`                                       |
| `claim_prompt_click`         | "Is this your business? Claim it" clicked         | All (unclaimed)                  | `{listing_id}`                                                   |
| `community_save_nudge_click` | Community save nudge CTA clicked                  | All                              | `{listing_id}`                                                   |
| `related_card_click`         | Related listing card clicked                      | All                              | `{listing_id, related_listing_id, position}`                     |
| `related_save_toggled`       | Save button on related listing card               | All                              | `{listing_id: related_listing_id, direction, source_listing_id}` |
| `scroll_depth_25`            | User scrolled 25% of page                         | All                              | `{listing_id}`                                                   |
| `scroll_depth_50`            | User scrolled 50% of page                         | All                              | `{listing_id}`                                                   |
| `scroll_depth_75`            | User scrolled 75% of page                         | All                              | `{listing_id}`                                                   |
| `scroll_depth_100`           | User scrolled 100% of page                        | All                              | `{listing_id}`                                                   |

### Beta Events (5)

| Event Name                | Trigger                                      | Applicable Entity Types | Key Properties                    |
| ------------------------- | -------------------------------------------- | ----------------------- | --------------------------------- |
| `correction_prompt_click` | "Suggest a correction" clicked               | All                     | `{listing_id}`                    |
| `job_deadline_view`       | Job deadline section scrolled into view      | Job                     | `{listing_id, deadline_date}`     |
| `ticket_link_click`       | Ticket purchase link clicked                 | Event                   | `{listing_id, ticket_url}`        |
| `apply_link_click`        | Apply Now link clicked                       | Job                     | `{listing_id, apply_url}`         |
| `commission_status_view`  | Commission status section scrolled into view | Creative                | `{listing_id, commission_status}` |

### V1 Events (4)

| Event Name              | Trigger                                    | Applicable Entity Types | Key Properties                          |
| ----------------------- | ------------------------------------------ | ----------------------- | --------------------------------------- | --------- |
| `video_embed_played`    | Embedded video play button pressed         | Professional, Creative  | `{listing_id, video_platform: 'youtube' | 'vimeo'}` |
| `review_form_opened`    | Write a review button clicked              | All                     | `{listing_id}`                          |
| `owner_response_viewed` | Owner response to review expanded          | All                     | `{listing_id, review_id}`               |
| `collection_link_click` | Collection tag link clicked from a listing | All                     | `{listing_id, collection_id}`           |

### V2 Events (4)

| Event Name                     | Trigger                               | Applicable Entity Types | Key Properties                                   |
| ------------------------------ | ------------------------------------- | ----------------------- | ------------------------------------------------ | ------ |
| `review_helpful_voted`         | "Was this helpful?" voted on a review | All                     | `{listing_id, review_id, vote: 'yes'             | 'no'}` |
| `vendor_product_card_click`    | Product card in storefront clicked    | Vendor                  | `{listing_id, product_id}`                       |
| `product_add_to_cart`          | Add to cart button pressed            | Vendor                  | `{listing_id, product_id, variant_id, quantity}` |
| `spend_attributed_badge_click` | Community spend badge clicked         | Vendor, Business        | `{listing_id}`                                   |

---

## 11. Flag Status Values

**See Section 2.4 for full definition.**

Quick reference:

| Value       | Meaning          | Listing Visible           | `noindex` |
| ----------- | ---------------- | ------------------------- | --------- |
| `none`      | Clean            | Yes (if status=published) | false     |
| `inactive`  | Appears closed   | No                        | true      |
| `duplicate` | Duplicate exists | No                        | true      |
| `incorrect` | Incorrect data   | No                        | true      |
| `spam`      | Fraudulent       | No                        | true      |

---

## 12. Media Entity Types

**Table:** `media_attachments`
**Column:** `entity_type`
**Constraint:** `CHECK (entity_type IN ('listing','product','review'))`
**Zod:** `z.enum(['listing','product','review'])`

| Value     | `entity_id` Points To | Storage Bucket  | Phase   |
| --------- | --------------------- | --------------- | ------- |
| `listing` | `listings.id`         | `listing-media` | **MVP** |
| `product` | `products.id`         | `listing-media` | **V2**  |
| `review`  | `reviews.id`          | `listing-media` | **V1**  |

**Index:** `CREATE INDEX media_entity_idx ON media_attachments (entity_type, entity_id)` — required for efficient gallery retrieval.

**Storage path convention:** `{entity_type}/{entity_id}/{filename}` within the `listing-media` bucket. Never store CDN URLs in this column — generate signed or public URLs at read time.

---

## 13. AI Status Values

### `ai_suggestions.status`

**(V2)** — See Section 2.11 for full definition.

| Value       | Meaning                              |
| ----------- | ------------------------------------ |
| `pending`   | Generated; not yet surfaced to owner |
| `shown`     | Displayed in owner dashboard         |
| `acted_on`  | Owner applied the suggestion         |
| `dismissed` | Owner dismissed without acting       |

### `ai_moderation_flags.status`

**(V2)** — See Section 2.12.

| Value               | Meaning                            |
| ------------------- | ---------------------------------- |
| `pending`           | Awaiting human review              |
| `reviewed_safe`     | Reviewer found content acceptable  |
| `reviewed_actioned` | Reviewer removed or edited content |
| `dismissed`         | Low confidence; auto-dismissed     |

### `ai_agent_runs.status`

**(V3)** — See Section 2.13.

| Value       | Meaning                     |
| ----------- | --------------------------- |
| `queued`    | Scheduled but not started   |
| `running`   | Actively executing          |
| `completed` | Finished successfully       |
| `failed`    | Error encountered           |
| `cancelled` | Cancelled before completion |

### `ai_agent_runs.agent_type`

**Constraint:** `CHECK (agent_type IN ('curator','optimizer','concierge'))`
**Zod:** `z.enum(['curator','optimizer','concierge'])`

| Value       | Purpose                                                    |
| ----------- | ---------------------------------------------------------- |
| `curator`   | Automated listing quality review and suggestion generation |
| `optimizer` | SEO and content optimization recommendations               |
| `concierge` | Personalized discovery recommendations for supporters      |

---

## 14. Subscription and Payment Status Values

### `subscriptions.status`

**(V1)** — See Section 2.9 for full state machine.

| Value       | Meaning                            |
| ----------- | ---------------------------------- |
| `trialing`  | In free trial                      |
| `active`    | Current; payment successful        |
| `past_due`  | Payment failed; retrying           |
| `cancelled` | Cancelled; access until period end |
| `paused`    | Billing paused (V1.5)              |

### `orders.status`

**(V2)** — See Section 2.8 for full state machine.

| Value                | Meaning                      |
| -------------------- | ---------------------------- |
| `pending`            | Created; not paid            |
| `payment_processing` | Stripe PaymentIntent created |
| `paid`               | Payment confirmed            |
| `fulfilling`         | Vendor acknowledged          |
| `shipped`            | Shipped                      |
| `delivered`          | Delivered                    |
| `completed`          | Finalized; payout triggered  |
| `cancelled`          | Cancelled                    |
| `refund_requested`   | Refund requested             |
| `refunded`           | Refund processed             |

### `sponsored_placements.is_active`

**Column type:** `boolean NOT NULL DEFAULT true`
**Auto-deactivation logic:** A scheduled daily function sets `is_active = false` on rows where `expires_at <= now()`. This also sets `listings.is_sponsored = false` and `listings.sponsored_expires_at = NULL` on the associated listing.

### `sponsored_placements.placement_type`

**Constraint:** `CHECK (placement_type IN ('homepage','search','category','city'))`
**Zod:** `z.enum(['homepage','search','category','city'])`

| Value      | Placement Context                                |
| ---------- | ------------------------------------------------ |
| `homepage` | Sponsored slot on the homepage discovery section |
| `search`   | Sponsored result at the top of search results    |
| `category` | Sponsored placement on a category landing page   |
| `city`     | Sponsored placement on a city landing page       |

---

## 15. Day of Week Convention

**Table:** `listing_hours`
**Column:** `day_of_week`
**Type:** `integer CHECK (day_of_week BETWEEN 0 AND 6)`
**Convention:** 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday

| Value | Day       |
| ----- | --------- |
| 0     | Sunday    |
| 1     | Monday    |
| 2     | Tuesday   |
| 3     | Wednesday |
| 4     | Thursday  |
| 5     | Friday    |
| 6     | Saturday  |

This follows the JavaScript `Date.getDay()` convention, not ISO 8601 (which starts weeks on Monday = 1). This choice aligns with client-side date rendering without conversion.

**`listing_hours` row structure:**

| Field         | Type                                        | Notes                                                      |
| ------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `listing_id`  | `uuid` FK → `listings.id` ON DELETE CASCADE |                                                            |
| `day_of_week` | `integer` 0–6                               |                                                            |
| `open_time`   | `time`                                      | Null if `is_closed = true`                                 |
| `close_time`  | `time`                                      | Null if `is_closed = true`                                 |
| `is_closed`   | `boolean NOT NULL DEFAULT false`            | True for closed days; open_time/close_time must be null    |
| `notes`       | `text`                                      | Optional: "Closed for lunch 12–1pm", "By appointment only" |

UNIQUE constraint on `(listing_id, day_of_week)` — one row per day per listing.

---

## 16. Employment Type Values

**(Beta)**
**Table:** `listing_details_job`
**Column:** `employment_type`
**Constraint:** `CHECK (employment_type IN ('full-time','part-time','contract','freelance','internship','volunteer'))`
**Nullable:** Yes (poster may not specify)
**Zod:** `z.enum(['full-time','part-time','contract','freelance','internship','volunteer']).nullable()`

| Value        | Display Label | Used For                            |
| ------------ | ------------- | ----------------------------------- |
| `full-time`  | "Full-Time"   | Traditional salaried employment     |
| `part-time`  | "Part-Time"   | < 30 hours/week positions           |
| `contract`   | "Contract"    | Fixed-term contract work            |
| `freelance`  | "Freelance"   | Project-based independent work      |
| `internship` | "Internship"  | Student or early-career internships |
| `volunteer`  | "Volunteer"   | Unpaid volunteer opportunities      |

---

## 17. Stripe Connect Status Values

**(V2)**
**Table:** `listing_details_vendor`
**Column:** `stripe_connect_status`
**Constraint:** `CHECK (stripe_connect_status IN ('not-started','pending','active','restricted'))`
**Default:** `'not-started'`
**Zod:** `z.enum(['not-started','pending','active','restricted'])`

| Value         | Meaning                                               | Storefront Visible | Payouts Enabled |
| ------------- | ----------------------------------------------------- | ------------------ | --------------- |
| `not-started` | Vendor has not begun Stripe Connect onboarding        | No                 | No              |
| `pending`     | Connect onboarding initiated but not complete         | No                 | No              |
| `active`      | Fully onboarded; Stripe account verified              | Yes                | Yes             |
| `restricted`  | Stripe restricted the account; requires vendor action | No                 | No              |

**Source of truth:** Synced from Stripe via `account.updated` and `capability.updated` webhooks. Never set manually except by the webhook handler.

---

## 18. Commission Status Values

**(Beta)**
**Table:** `listing_details_creative`
**Column:** `commission_status`
**Constraint:** `CHECK (commission_status IN ('open','closed','by-request'))`
**Nullable:** Yes
**Zod:** `z.enum(['open','closed','by-request']).nullable()`

| Value        | Display Label            | Shown As             | CTA Impact                                  |
| ------------ | ------------------------ | -------------------- | ------------------------------------------- |
| `open`       | "Open for Commissions"   | Green status chip    | `commission` CTA enabled                    |
| `closed`     | "Not Taking Commissions" | Red/gray status chip | `commission` CTA hidden                     |
| `by-request` | "By Request Only"        | Amber status chip    | `inquire` CTA shown instead of `commission` |

---

## 19. Consultation Type Values

**(Beta)**
**Table:** `listing_details_professional`
**Column:** `consultation_type`
**Constraint:** `CHECK (consultation_type IN ('in-person','virtual','both'))`
**Nullable:** Yes
**Zod:** `z.enum(['in-person','virtual','both']).nullable()`

| Value       | Display Label             | Address Required |
| ----------- | ------------------------- | ---------------- |
| `in-person` | "In-Person Consultations" | Recommended      |
| `virtual`   | "Virtual Consultations"   | No               |
| `both`      | "In-Person & Virtual"     | Optional         |

---

## 20. Event Location Type Values

**(Beta)**
**Table:** `listing_details_event`
**Column:** `location_type`
**Constraint:** `CHECK (location_type IN ('in-person','virtual','hybrid'))`
**Default:** `'in-person'`
**Zod:** `z.enum(['in-person','virtual','hybrid'])`

Note: This is a **separate field** from `listings.location_type`. This field is scoped to the event detail table and uses a different value set.

| Value       | Address Display             | Virtual Link Display |
| ----------- | --------------------------- | -------------------- |
| `in-person` | Show venue name and address | No                   |
| `virtual`   | Show virtual meeting link   | Yes                  |
| `hybrid`    | Show both                   | Yes                  |

---

## 21. Job Location Type Values

**(Beta)**
**Table:** `listing_details_job`
**Column:** `location_type`
**Constraint:** `CHECK (location_type IN ('in-person','remote','hybrid'))`
**Default:** `'in-person'`
**Zod:** `z.enum(['in-person','remote','hybrid'])`

Note: Separate from `listings.location_type` and from `listing_details_event.location_type`.

| Value       | Display Label | Address Required      |
| ----------- | ------------- | --------------------- |
| `in-person` | "On-Site"     | Yes                   |
| `remote`    | "Remote"      | No                    |
| `hybrid`    | "Hybrid"      | Yes (office location) |

---

## 22. Price Type Values

**Table:** `services`
**Column:** `price_type`
**Constraint:** `CHECK (price_type IN ('fixed','starting-at','hourly','custom','free'))`
**Nullable:** Yes (null at MVP; added at V1)
**Zod:** `z.enum(['fixed','starting-at','hourly','custom','free']).nullable()`

| Value         | Display Format                | `price` Field | `price_note` Field |
| ------------- | ----------------------------- | ------------- | ------------------ |
| `fixed`       | "$75"                         | Required      | Optional           |
| `starting-at` | "From $75"                    | Required      | Optional           |
| `hourly`      | "$75 / hour"                  | Required      | Optional           |
| `custom`      | Uses `price_note` string only | Null          | Required           |
| `free`        | "Free"                        | Null (or 0)   | Optional           |

---

## 23. Product and Coupon Values

### `products.status`

**(V2)**
**Constraint:** `CHECK (status IN ('active','draft','archived'))`
**Default:** `'draft'`
**Zod:** `z.enum(['active','draft','archived'])`

| Value      | Storefront Visible | Purchasable | Notes                                     |
| ---------- | ------------------ | ----------- | ----------------------------------------- |
| `active`   | Yes                | Yes         | Appears in vendor storefront              |
| `draft`    | No                 | No          | Vendor editing; not yet published         |
| `archived` | No                 | No          | Discontinued; preserved for order history |

### `coupons.discount_type`

**(V2)**
**Constraint:** `CHECK (discount_type IN ('percent','fixed'))`
**Zod:** `z.enum(['percent','fixed'])`

| Value     | Meaning                 | `discount_value` Interpretation               |
| --------- | ----------------------- | --------------------------------------------- |
| `percent` | Percentage off subtotal | 0–100; e.g., `20` = 20% off                   |
| `fixed`   | Fixed USD amount off    | USD cents or decimal; e.g., `10.00` = $10 off |

---

## 24. Spend Event Source Values

**(V2)**
**Table:** `spend_events`
**Column:** `source`
**Constraint:** `CHECK (source IN ('marketplace-purchase','receipt-upload'))`
**Zod:** `z.enum(['marketplace-purchase','receipt-upload'])`

| Value                  | Meaning                                       | `listing_id` Source                                                     |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| `marketplace-purchase` | In-platform marketplace order                 | Set from `orders.vendor_listing_id` at order creation                   |
| `receipt-upload`       | User-uploaded receipt attributed to a listing | Set via merchant name matching after OCR; may require user confirmation |

---

## 25. Moderation Queue Item Types

**Table:** `moderation_queue`
**Column:** `item_type`
**Constraint:** `CHECK (item_type IN ('claim_review','correction','review_approval','flagged_listing','verification_document'))`
**Zod:** `z.enum(['claim_review','correction','review_approval','flagged_listing','verification_document'])`

| Value                   | Source Table                      | Priority Default | Phase    |
| ----------------------- | --------------------------------- | ---------------- | -------- |
| `claim_review`          | `claims`                          | High             | **MVP**  |
| `correction`            | `corrections`                     | Medium           | **Beta** |
| `review_approval`       | `reviews`                         | Medium           | **V1**   |
| `flagged_listing`       | `listings` (flag_status ≠ 'none') | High             | **MVP**  |
| `verification_document` | `verification_submissions`        | High             | **V1**   |

**`moderation_queue` key fields:**

| Field         | Type                                                             | Notes                                                                |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `item_type`   | `text`                                                           | See above                                                            |
| `item_id`     | `uuid`                                                           | FK to the source table row; not a formal FK constraint (polymorphic) |
| `priority`    | `text` CHECK IN ('high','medium','low')                          | Determines queue sort order                                          |
| `status`      | `text` CHECK IN ('pending','in_progress','resolved','dismissed') | Queue item workflow state                                            |
| `assigned_to` | `uuid` FK → `profiles.id` ON DELETE SET NULL                     | Admin user assigned to this item                                     |
| `created_at`  | `timestamptz`                                                    | When the item entered the queue                                      |
| `updated_at`  | `timestamptz`                                                    | Trigger-updated                                                      |

---

## Appendix: Field Name Quick Reference

Cross-reference of all enum columns by table for use when writing migrations and zod schemas.

| Table                          | Column                  | Values                                                                                                              | Default     | Nullable | Phase |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------- | -------- | ----- |
| `listings`                     | `entity_type`           | business, professional, creative, event, job, vendor                                                                | —           | No       | MVP   |
| `listings`                     | `status`                | draft, pending, published, unpublished, flagged, archived                                                           | draft       | No       | MVP   |
| `listings`                     | `tier`                  | free, standard, premium                                                                                             | free        | No       | MVP   |
| `listings`                     | `source`                | owner, community, admin, import                                                                                     | owner       | No       | MVP   |
| `listings`                     | `location_type`         | physical, online, hybrid, virtual-services, ships-nationwide                                                        | physical    | No       | MVP   |
| `listings`                     | `trust_tier`            | unclaimed, claimed, verified, certified                                                                             | unclaimed   | No       | MVP   |
| `listings`                     | `verification_status`   | none, pending, under_review, verified, rejected                                                                     | none        | No       | MVP   |
| `listings`                     | `flag_status`           | none, inactive, duplicate, incorrect, spam                                                                          | none        | No       | MVP   |
| `user_roles`                   | `role`                  | supporter, owner, editor, admin, super_admin                                                                        | —           | No       | MVP   |
| `media_attachments`            | `entity_type`           | listing, product, review                                                                                            | —           | No       | MVP   |
| `listing_details_business`     | `cta_type`              | book, order, call, message, visit, get-quote, shop, subscribe, contact                                              | visit       | No       | MVP   |
| `listing_details_business`     | `price_range`           | $, $$, $$$, $$$$                                                                                                    | —           | Yes      | V1    |
| `listing_details_professional` | `cta_type`              | book, schedule, inquire, call, message, contact                                                                     | book        | No       | Beta  |
| `listing_details_professional` | `consultation_type`     | in-person, virtual, both                                                                                            | —           | Yes      | Beta  |
| `listing_details_creative`     | `cta_type`              | book, commission, inquire, contact, shop                                                                            | contact     | No       | Beta  |
| `listing_details_creative`     | `commission_status`     | open, closed, by-request                                                                                            | —           | Yes      | Beta  |
| `listing_details_event`        | `cta_type`              | get-tickets, rsvp, register, learn-more                                                                             | get-tickets | No       | Beta  |
| `listing_details_event`        | `location_type`         | in-person, virtual, hybrid                                                                                          | in-person   | No       | Beta  |
| `listing_details_job`          | `cta_type`              | apply, learn-more, contact                                                                                          | apply       | No       | Beta  |
| `listing_details_job`          | `employment_type`       | full-time, part-time, contract, freelance, internship, volunteer                                                    | —           | Yes      | Beta  |
| `listing_details_job`          | `location_type`         | in-person, remote, hybrid                                                                                           | in-person   | No       | Beta  |
| `listing_details_job`          | `salary_type`           | annual, hourly, project                                                                                             | —           | Yes      | Beta  |
| `listing_details_vendor`       | `cta_type`              | shop, browse, order, visit-store                                                                                    | shop        | No       | V2    |
| `listing_details_vendor`       | `stripe_connect_status` | not-started, pending, active, restricted                                                                            | not-started | No       | V2    |
| `claims`                       | `status`                | pending, under_review, approved, rejected                                                                           | pending     | No       | MVP   |
| `reviews`                      | `status`                | pending, approved, rejected, flagged                                                                                | pending     | No       | MVP   |
| `corrections`                  | `status`                | pending, under_review, resolved, dismissed                                                                          | pending     | No       | Beta  |
| `services`                     | `price_type`            | fixed, starting-at, hourly, custom, free                                                                            | —           | Yes      | V1    |
| `services`                     | `cta_type`              | book, inquire, call, contact                                                                                        | —           | Yes      | V1    |
| `products`                     | `status`                | active, draft, archived                                                                                             | draft       | No       | V2    |
| `orders`                       | `status`                | pending, payment_processing, paid, fulfilling, shipped, delivered, completed, cancelled, refund_requested, refunded | pending     | No       | V2    |
| `subscriptions`                | `status`                | trialing, active, past_due, cancelled, paused                                                                       | —           | No       | V1    |
| `coupons`                      | `discount_type`         | percent, fixed                                                                                                      | —           | No       | V2    |
| `spend_events`                 | `source`                | marketplace-purchase, receipt-upload                                                                                | —           | No       | V2    |
| `receipt_uploads`              | `status`                | pending, confirmed, processed, rejected                                                                             | pending     | No       | V2    |
| `sponsored_placements`         | `placement_type`        | homepage, search, category, city                                                                                    | —           | No       | V1    |
| `ai_suggestions`               | `status`                | pending, shown, acted_on, dismissed                                                                                 | pending     | No       | V2    |
| `ai_moderation_flags`          | `status`                | pending, reviewed_safe, reviewed_actioned, dismissed                                                                | pending     | No       | V2    |
| `ai_agent_runs`                | `status`                | queued, running, completed, failed, cancelled                                                                       | queued      | No       | V3    |
| `ai_agent_runs`                | `agent_type`            | curator, optimizer, concierge                                                                                       | —           | No       | V3    |
| `editorial_articles`           | `status`                | draft, in_review, published, archived                                                                               | draft       | No       | V1    |
| `guides`                       | `status`                | draft, in_review, published, archived                                                                               | draft       | No       | V1    |
| `verification_submissions`     | `decision`              | pending, approved, rejected                                                                                         | pending     | No       | V1    |
| `moderation_queue`             | `item_type`             | claim_review, correction, review_approval, flagged_listing, verification_document                                   | —           | No       | MVP   |
| `moderation_queue`             | `priority`              | high, medium, low                                                                                                   | medium      | No       | MVP   |
| `moderation_queue`             | `status`                | pending, in_progress, resolved, dismissed                                                                           | pending     | No       | MVP   |
| `listing_hours`                | `day_of_week`           | 0–6 (integer)                                                                                                       | —           | No       | MVP   |
