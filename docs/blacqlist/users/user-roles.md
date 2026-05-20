# User Roles — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product

This document defines every user role on The BLACQList — their goals, context, permissions, primary workflows, and the phase in which they are introduced.

---

## Role Overview

| Role | Introduced | Description |
|---|---|---|
| Anonymous Visitor | MVP | Not logged in. Can search and view Pages. Cannot save or review. |
| Supporter / Discoverer | MVP | Logged-in community member who finds and supports Black-owned entities. |
| Business Owner | MVP | Manages a claimed BLACQList Page for their business. |
| Professional | V1 | Manages a claimed BLACQList Page for their individual professional practice. |
| Creative | V1 | Manages a claimed BLACQList Page for their creative practice or brand. |
| Event Organizer | V1 | Creates and manages Event Pages. May be a Business Owner or independent. |
| Job Poster | V1 | Posts job or opportunity listings. May be a Business Owner or independent. |
| Marketplace Vendor | V2 | Business owner who also manages a vendor storefront with purchasable products. |
| Sponsor | V3 | Purchases sponsored placements and campaign packages. |
| Editor | V1 | Internal role. Creates and manages BLACQLight articles, collections, and guides. |
| Admin | MVP | Internal role. Full platform access for moderation, verification, and management. |
| Super Admin | MVP | Internal role. System configuration and sensitive data access. |

---

## Role Definitions

---

### Anonymous Visitor

**Phase:** MVP
**Goal:** Find a Black-owned business, professional, or service without friction.
**Context:** On a mobile phone or desktop. Arrived via Google search, a social share link, or word of mouth. Has not signed up.

**What they can do:**
- Search by keyword, category, and city
- Browse category and city landing pages
- View any public BLACQList Page
- See claimed/verified status on a Page
- Click CTAs (visit website, call, get directions)
- Share a Page via link

**What they cannot do:**
- Save listings
- Write reviews
- Submit a claim
- Correct a listing
- Access any dashboard

**Conversion path:**
Anonymous Visitor → Supporter (sign up to save a listing)
Anonymous Visitor → Business Owner (sign up to claim a listing)

---

### Supporter / Discoverer

**Phase:** MVP
**Goal:** Discover, trust, support, and keep track of Black-owned businesses and entities they want to return to.
**Context:** Mobile-first. In an everyday purchasing mindset. May be at home researching or in the moment searching for something nearby.

**What they can do:**
- Everything an Anonymous Visitor can do
- Save listings to personal saved list
- Organize saves (V1: basic list; V2: named lists)
- Write reviews on verified listings (V1)
- Upload receipts and log off-platform spend (V2)
- View personal spend dashboard (V2)
- Follow businesses and receive updates (V1: lightweight)

**What they cannot do:**
- Claim or manage listings
- Access admin or editorial tools
- Create sponsored placements

**Primary workflows:**
1. Search → find listing → save or share
2. View saved list → visit or buy
3. View BLACQList Page → write review (V1)
4. Upload receipt → confirm spend category (V2)

---

### Business Owner

**Phase:** MVP
**Goal:** Create or claim a polished BLACQList Page that makes their business discoverable, trustworthy, and ready to drive real action (calls, visits, bookings, orders).
**Context:** Small to mid-size Black-owned business. May have an existing website or social presence. Frustrated with how generic platforms represent them. Not necessarily technical.

**What they can do:**
- Search for and claim an existing listing
- Create a new listing
- Edit all fields on their BLACQList Page
- Upload logo, cover image, and gallery images
- Set primary CTA (booking URL, phone, website)
- Add service/offering descriptions
- View owner dashboard
- See Page view count, CTA click count, save count, share count (V1: analytics dashboard)
- Respond to reviews on their Page (V1)
- Submit documents for trust verification (V1)
- Upgrade to a paid listing tier (V1)
- Opt in to being visible on the dollar-flow map (V3)

**What they cannot do:**
- Approve other users' claims
- Access other businesses' data
- Access admin tools
- Set sponsored placements directly (V1: must contact sales or use self-serve sponsor tools in V3)

**Primary workflows:**
1. Sign up → search for listing → claim → complete Page → go live
2. Sign in → edit Page → update hours, add service, change CTA
3. Sign in → view analytics → see Page performance (V1)
4. Sign in → read and respond to reviews (V1)
5. Sign in → upgrade listing tier → enter payment (V1)

**Pain points to design for:**
- Not sure how to write a good business description (AI optimization agent can help in V2)
- Doesn't know what category to choose (smart suggestions needed)
- Doesn't have professional photography (gallery should work with phone photos)
- Has never claimed a listing before — onboarding must be clear

---

### Professional

**Phase:** V1
**Goal:** Establish a trusted, professional online presence that attracts clients and builds credibility.
**Context:** Freelancer, consultant, attorney, therapist, coach, financial advisor, or other individual service provider. May have a website but no single platform that combines their story, credentials, reviews, and contact in one place.

**What they can do:**
- Everything a Business Owner can do, within the Professional Page template
- Add credentials, certifications, and education
- List individual services with pricing or "contact for pricing"
- Add a portfolio (for consultants, coaches, creatives who work as professionals)
- Link professional social profiles (LinkedIn, portfolio site)
- Enable booking or consultation request (via external link or contact form)

**What they cannot do:**
- Add multiple locations (professionals are tied to a single service area or virtual)
- Post jobs under their professional profile (must create a separate job listing)

**Primary workflows:**
1. Sign up → create Professional Page → add credentials → publish
2. Sign in → update availability or service offerings
3. Sign in → view inquiries and analytics

---

### Creative

**Phase:** V1
**Goal:** Showcase their work, attract clients and audiences, and be discoverable for bookings, commissions, and collaborations.
**Context:** Visual artist, photographer, musician, author, designer, filmmaker, performer. May have an Instagram but no platform that combines their portfolio, biography, booking information, and community trust signals.

**What they can do:**
- Everything a Business Owner can do, within the Creative Page template
- Upload a rich portfolio (images, video links, audio samples)
- List mediums, genres, or disciplines
- Add booking or commission request link
- Add event appearances (link to Event Pages)
- Enable fan or follower saves (supporters can follow creatives)

**Primary workflows:**
1. Sign up → create Creative Page → upload portfolio → publish
2. Sign in → add new work → share Page
3. Sign in → view analytics → see which portfolio items drive the most engagement

---

### Event Organizer

**Phase:** V1
**Goal:** Promote and manage a ticketed or free event through a BLACQList Page that drives attendance.
**Context:** Individual organizer, business owner (adding an event to their existing Page), or community organization hosting a one-time or recurring event.

**What they can do:**
- Create an Event Page (title, date/time, location or virtual, description, ticket/RSVP link, cover image)
- Link Event Page to a Business or Professional Page (if they have one)
- Add co-organizers or featured performers/vendors
- Edit event details until event date
- View RSVP or ticket click counts

**Event auto-expiry:** Event Pages are automatically marked as "past" after the event date. Past events remain visible but are filtered out of search results unless the user explicitly searches for past events.

**Primary workflows:**
1. Create Event Page → set date + ticket link → publish
2. Update event details → notify followers (V2)
3. View event analytics → see click-through to ticket page

---

### Job Poster

**Phase:** V1
**Goal:** Find qualified candidates from within the Black community.
**Context:** Business owner, HR manager, or independent hiring manager. May or may not have a BLACQList business Page.

**What they can do:**
- Create a Job/Opportunity listing (title, description, company, location, apply link, deadline)
- Link to a Business Page if they have one
- Set listing duration (30, 60, or 90 days — paid in V2)
- Edit or remove the listing before it expires

**What they cannot do:**
- Receive applications through the platform (apply link directs off-platform at MVP)

**Primary workflows:**
1. Sign up or sign in → create job listing → set apply link → publish
2. Sign in → edit listing details
3. Sign in → view click-through count on apply link

---

### Marketplace Vendor

**Phase:** V2
**Goal:** Sell physical or digital products through The BLACQList to an engaged community of buyers.
**Context:** May already have a BLACQList Business Page. Sells handmade goods, branded merchandise, food products, apparel, beauty products, digital content, or other items.

**What they can do:**
- Upgrade their Business Page to include a vendor storefront
- Create product listings (title, description, images, price, variants, inventory count)
- Manage orders from their vendor dashboard
- Issue refunds and update fulfillment status
- Connect Stripe account for payouts
- View vendor-specific analytics (sales, revenue, top products)

**What they cannot do:**
- See other vendors' sales data
- List services alongside products without a separate Professional or Business Page

**Primary workflows:**
1. Upgrade Business Page → connect Stripe → add products → go live
2. Receive order notification → fulfill → mark shipped
3. View vendor dashboard → see revenue, top products, pending orders

---

### Sponsor

**Phase:** V3
**Goal:** Reach a highly engaged community of Black consumers and businesses with targeted, brand-aligned campaigns.
**Context:** Brand, organization, or individual investor. Values community credibility over mass reach.

**What they can do:**
- Create and manage sponsored campaign packages
- Target campaigns by city, category, or audience segment
- Track campaign performance (impressions, clicks, conversions)
- Access the sponsor dashboard

**What they cannot do:**
- Access any user's personal data
- Override editorial decisions
- Purchase guaranteed placement on specific BLACQList Pages without admin approval

---

### Editor

**Phase:** V1
**Goal:** Create and manage editorial content that gives the community a reason to visit beyond search.
**Context:** Internal team member. May be a staff editor or trusted community contributor.

**What they can do:**
- Create BLACQLight articles
- Create curated collections (e.g., "10 Black-owned bookstores worth visiting")
- Create city guides
- Feature specific BLACQList Pages in editorial content
- Schedule publish dates
- Edit and unpublish content

**What they cannot do:**
- Approve claims or verify businesses
- Access financial or analytics data

---

### Admin

**Phase:** MVP
**Goal:** Maintain platform quality, integrity, and trust at scale.
**Context:** Internal team member. Has elevated access to review, approve, and manage all platform content and user actions.

**What they can do:**
- View and edit all listings
- Approve or reject claim requests
- Manage the trust verification queue (V1)
- Moderate reviews (V1)
- Moderate community corrections (V1)
- View platform analytics
- Manage user accounts (suspend, unsuspend, role changes)
- Publish and manage editorial content (V1)
- Flag listings for quality review

**What they cannot do:**
- Change system configuration (Super Admin only)
- Access financial data beyond basic platform stats

---

### Super Admin

**Phase:** MVP
**Goal:** System health and platform configuration.
**Context:** Founder or technical lead only. Minimal set of people.

**What they can do:**
- Everything Admin can do
- Access system settings and environment configuration
- View all financial reports
- Assign and revoke Admin role
- Access audit logs

---

## Permission Matrix Summary

| Permission | Anonymous | Supporter | Owner | Admin | Super Admin |
|---|---|---|---|---|---|
| View public Pages | ✓ | ✓ | ✓ | ✓ | ✓ |
| Search + browse | ✓ | ✓ | ✓ | ✓ | ✓ |
| Save listings | — | ✓ | ✓ | ✓ | ✓ |
| Write reviews | — | ✓ (V1) | — | ✓ | ✓ |
| Claim listing | — | — | ✓ | ✓ | ✓ |
| Edit own Page | — | — | ✓ | ✓ | ✓ |
| Edit any listing | — | — | — | ✓ | ✓ |
| Approve claims | — | — | — | ✓ | ✓ |
| View all listings (admin view) | — | — | — | ✓ | ✓ |
| Manage users | — | — | — | ✓ | ✓ |
| System config | — | — | — | — | ✓ |
| Financial reports | — | — | ✓ (own) | — | ✓ |

---

## Assumptions

- Most users start as Supporters and self-select into Owner if they have a business
- Business Owners and Professionals are the same account — role is determined by the listing type they create
- A single user can have multiple roles (e.g., a business owner who is also a supporter and a reviewer)
- Admin users are internal only — no business owner gets Admin access regardless of tier

---

## Open Questions

1. Should the Supporter role be the default for all new signups, or should there be an explicit "I have a business" branching during onboarding?
2. Can a Professional and a Business Owner exist on the same account (one user who is both a freelancer and a business owner)?
3. Should the Editor role be a formal role or just Admin with limited scope?
4. What is the process for revoking a Business Owner's claim if the business closes or is found to be fraudulent?

---

## Do Not Overbuild Yet

- Do not build the Vendor, Sponsor, or Editor dashboards before their phases
- Do not build complex multi-role account management before the single-role happy paths are validated
- Do not build role-switching UI before at least two roles exist and are in active use
- Do not build the full permission matrix in code before MVP roles (Anonymous, Supporter, Owner, Admin) are confirmed working
