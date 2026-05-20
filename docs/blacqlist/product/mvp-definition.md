# MVP Definition — The BLACQList

**Last updated:** 2026-05-07
**Status:** Source of truth
**Owner:** Product

The MVP is not a prototype. It is the smallest version of The BLACQList that a real user — someone with no obligation to use the platform — can get genuine value from on launch day.

---

## The MVP Value Thesis

A person opens The BLACQList.
They search for what they need.
They find a polished, trusted listing.
They take an action.

A business owner opens The BLACQList.
They claim or create their Page.
They look the way they deserve to look.
They get found.

That is the complete MVP loop. Everything else is V1 or later.

---

## The Minimum Viable Test

The MVP is validated when:

1. A non-founder user can search for a Black-owned business by keyword or category in at least one city and find a polished result within 30 seconds
2. A business owner who has never used the platform can create or claim a BLACQList Page in under 15 minutes
3. At least one BLACQList Page looks meaningfully better than the same business's Google Business or Yelp page
4. A user can save a listing and share it externally
5. An admin can manage listings, review claims, and flag inactive or incorrect listings from a dashboard

---

## MVP Feature List

### Core Discovery
| Feature | Priority | Notes |
|---|---|---|
| Keyword search (name, type, description) | Must-have | Full-text search across all listing fields |
| Category filter | Must-have | Top-level categories defined at launch |
| City filter | Must-have | Filter results by city/metro |
| Search results page with listing cards | Must-have | Cards show: name, category, city, primary image, save button |
| Empty search state with suggestions | Must-have | Suggest popular categories or nearby results |

### BLACQList Pages — Business Template
| Feature | Priority | Notes |
|---|---|---|
| Hero section (cover image, name, tagline) | Must-have | |
| About section (business description) | Must-have | |
| Category + subcategory tags | Must-have | |
| Location (address or city-only) | Must-have | Address optional for service-area businesses |
| Hours | Must-have | |
| Contact info (phone, email, website) | Must-have | |
| Social links | Should-have | Instagram, Facebook, LinkedIn, TikTok |
| Gallery (up to 12 images) | Should-have | |
| Offerings/services section | Should-have | Simple list of services with optional description |
| Primary CTA (configurable: book, order, contact, visit) | Must-have | |
| Share button | Must-have | Copy link + social share |
| Claimed/verified badge | Must-have | Status indicator |
| Page SEO metadata (title, description, OG tags) | Must-have | Pages must be indexable |

### Claim + Create + Manage
| Feature | Priority | Notes |
|---|---|---|
| Search for existing listing to claim | Must-have | |
| Submit claim request with verification info | Must-have | |
| Create new listing flow | Must-have | |
| Business owner dashboard | Must-have | View/edit Page, see basic stats, manage claim status |
| Email notification on claim approval/rejection | Must-have | |
| Owner can edit all Page fields | Must-have | |
| Owner can upload logo and cover image | Must-have | |

### Saves + Shares
| Feature | Priority | Notes |
|---|---|---|
| Save any listing (for logged-in users) | Must-have | |
| Saved list view in user account | Must-have | |
| Share listing via link | Must-have | |
| Share listing to social (Open Graph preview) | Must-have | |

### User Accounts
| Feature | Priority | Notes |
|---|---|---|
| Sign up (email + password) | Must-have | |
| Sign in / sign out | Must-have | |
| Password reset | Must-have | |
| Basic user profile (display name, email) | Must-have | |
| Role assignment (supporter vs. business owner) | Must-have | |

### Admin Dashboard
| Feature | Priority | Notes |
|---|---|---|
| View all listings | Must-have | |
| Approve or reject claim requests | Must-have | |
| Edit any listing | Must-have | |
| Flag listing as inactive or incorrect | Must-have | |
| View basic platform stats (total listings, new listings, claims) | Must-have | |

---

## Not In MVP

These are V1 or later. Do not build them until MVP is shipped and validated.

| Feature | Phase | Why Deferred |
|---|---|---|
| Reviews + ratings | V1 | Requires moderation workflow; add after listing quality is established |
| Trust certification (beyond claimed badge) | V1 | Manual review bottleneck — build queue tooling in V1 |
| Community corrections | V1 | Requires moderation queue; add after launch |
| Professional, creative, event, job Page templates | V1 | Build business template first, validate, then extend |
| Supporter dashboard | V1 | Basic saved list is sufficient for MVP |
| Editorial (BLACQLight, collections, guides) | V1 | Requires editorial team — not a launch-day dependency |
| Listing tiers / monetization | V1 | Validate usage before charging |
| Sponsored placements | V1 | Needs baseline traffic before value is demonstrable |
| Marketplace (vendors, products, checkout) | V2 | Commerce layer depends on healthy directory |
| Receipt upload | V2 | Requires spend tracking data model |
| Dollar-flow map | V3 | Requires months of transaction data |
| AI concierge | V2 | Requires listing data quality to be high before AI adds value |
| Analytics dashboards | V1 | Basic stats in MVP; rich analytics in V1 |
| Mobile app | Post-V2 | Web-first; responsive mobile web is sufficient at MVP |

---

## MVP Acceptance Criteria

### For users (searchers/supporters):
- [ ] Can search by keyword and return relevant results in under 2 seconds
- [ ] Can filter by category and city independently or together
- [ ] Can view a BLACQList Page that includes all must-have fields
- [ ] Can save a listing from search results or the Page itself
- [ ] Can share a listing link that previews correctly on social media (OG tags)
- [ ] Can create an account and sign in
- [ ] Can view their saved listings list

### For business owners:
- [ ] Can search for and claim an existing listing
- [ ] Can create a new listing
- [ ] Can upload a logo and cover image
- [ ] Can edit all Page fields from their dashboard
- [ ] Can set a primary CTA (booking link, phone, website)
- [ ] Receives email confirmation when claim is approved or rejected

### For admins:
- [ ] Can view all listings and filter by status (claimed, unclaimed, flagged)
- [ ] Can approve or reject a claim request
- [ ] Can edit any listing directly
- [ ] Can see total listing count, new listings this week, and pending claims

### Technical:
- [ ] All BLACQList Pages are server-rendered and indexable by Google
- [ ] Search returns results for at least 3 major cities at launch (Atlanta + 2)
- [ ] Image uploads are served via CDN
- [ ] Auth is functional and secure
- [ ] Mobile-responsive at 375px minimum

---

## Launch Data Requirements

The MVP must have minimum seed data to be usable on day one:

| City | Minimum listings at launch |
|---|---|
| Atlanta | 150+ |
| Houston | 50+ |
| Chicago | 50+ |

All seed listings must have: name, category, city, description, and at least one contact method. Target: 40% have a logo or photo.

---

## Assumptions

- One business Page template is sufficient for MVP — professionals and creatives can use it with minor field adaptation
- Business owners will be willing to claim their listing without a financial incentive at MVP
- 150+ Atlanta listings can be seeded before launch through outreach + scraping + community contributions
- SEO indexability is achievable at MVP with Next.js server rendering and standard meta tags

---

## Open Questions

1. Should reviews be enabled in MVP with no moderation, or held until V1 when moderation is ready?
2. Should the MVP support Google/social OAuth for signup, or email-only?
3. How do we handle duplicate listings at MVP — admin-only dedup, or community-flagging?
4. What is the minimum image quality threshold for a listing to be marked "complete"?
5. Should MVP include a public-facing "add a listing" flow, or is creation admin-only at launch?

---

## Do Not Overbuild Yet

- Do not add subcategory taxonomy until top-level categories are validated by real usage
- Do not build review moderation workflows for MVP — hold reviews until V1
- Do not build more than one Page template for MVP — business template only
- Do not build analytics beyond a basic count dashboard for admins at MVP
- Do not build monetization (tiers, sponsored placements) until there is baseline traffic
- Do not build mobile-native (iOS/Android) until the responsive web experience is validated
