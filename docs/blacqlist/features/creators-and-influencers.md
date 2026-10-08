# Creators & Influencers

**Audience:** the founder, and whoever builds tickets 131 to 135.
**Status:** Approved plan (founder, 2026-10-08). Not built yet.
**Last updated:** 2026-10-08
**Tickets:** [131](../tickets/131-creator-entity-and-category.md), [132](../tickets/132-creator-sign-up-path.md), [133](../tickets/133-creator-social-links-and-link-paywall-fix.md), [134](../tickets/134-partners-filter-and-badges.md), [135](../tickets/135-home-creators-band.md)

---

## The problem

People can't find Black creators and influencers on The BLACQList. Businesses can't find creators to hire or partner with. Creators can't find businesses that sponsor.

Today the directory has an "Influencer Marketing" subcategory, "Content Creation" and "Content Creation & Reels". All 16 listings in them are agencies or studios. There are no individual creators. Every one of those listings is the `business` type, so there is nowhere to say what a creator makes, where they post, or how big their audience is. Nothing tells a business that a creator is open to brand deals, or a creator that a business sponsors.

## Who it is for

| Person | What they want |
|---|---|
| Shopper / fan | Find Black creators and Ally creators they'd like to follow, by what they make (food, beauty, money, gaming...) |
| Business owner | Find creators to hire or partner with, filtered by niche, platform and audience size, and see who is open to brand deals |
| Creator | Get listed for free, show their socials, say they're open to brand deals, and find businesses open to creator partnerships and sponsorships |

## Jobs to be done

- When I want new people to follow, I want to browse Black creators by niche, so I can find voices I like.
- When I plan a campaign, I want to find creators in my niche who are open to brand deals, so I can reach out through the contact they chose.
- When I look for sponsors, I want to find businesses that say they're open to creator partnerships, so I don't pitch blind.

## Founder decisions (2026-10-08)

| Topic | Decision |
|---|---|
| Scope | Directory plus partner switches. Contact goes through each page's existing contact button. No messaging and no introductions; The BLACQList still makes no introductions. |
| Organization | One Creators group that is easy to find as a group. Niche is a filter inside it. Creators get a spot on the home page so it's clear they are a group on the platform. |
| Label | "Black Creator" / "Ally Creator". The same two-label system, worded for people. |
| Sourcing | Creators add themselves only. We never publish a person's page without their consent. |
| Social links | Free on creator pages. Businesses stay on Starter for socials. |
| Tag limit | Creator niche, platform and audience tags don't count toward the Free plan's 3-tag limit. |
| Audience size | A range the creator reports, shown as "self-reported". |
| Rollout | Public sign-up at launch. No creator invite links. Built now, live when the coming-soon gate flips. |

## How it works

### A creator listing type

Creators get their own listing type, `creator`, separate from `creative`. `creative` is for artists, photographers and authors you commission. A separate type gives creators:

- their own Discover chip, "Creators"
- their own page address, `/atlanta/creator/jane-doe`, or `/online/creator/jane-doe` with no city
- filters that only show for creators (filter groups can only be scoped by listing type)

### A Creators & Influencers category

A new parent category, **Creators & Influencers** (`creators-influencers`), split by format:

| Subcategory | Slug |
|---|---|
| Influencers | `influencers` |
| Video Creators | `video-creators` |
| Podcasters | `podcasters` |
| Streamers | `streamers` |
| Writers & Newsletters | `writers-newsletters` |

"Influencer Marketing" stays where it is, for agencies.

### Creator filters

Three filter groups that only show on creator pages and on `/discover?type=creator`:

| Group | Kind | Values |
|---|---|---|
| Niche | Pick up to 3 | Food & Drink, Beauty, Fashion, Fitness & Wellness, Travel, Parenting & Family, Money & Business, Tech, Gaming, Music, Comedy, Lifestyle, Faith, Education, Culture & History, Home & DIY |
| Platforms | Pick any | Instagram, TikTok, YouTube, Podcast, Twitch, Facebook, X, LinkedIn, Substack/Blog |
| Audience size (self-reported) | Pick one | Under 10K, 10K to 50K, 50K to 250K, 250K to 1M, 1M+ |

None of these count toward the Free plan's 3-tag limit.

### Partner switches

One switch on every page, worded by type:

- Creator pages: **"Open to brand deals"**
- Every other page: **"Open to creator partnerships & sponsorships"**

A switched-on page shows a small badge (text plus icon) on its card and its page. A new Discover filter, **Open to partnerships**, finds them:

- Businesses find creators at `/discover?type=creator&partners=1`.
- Creators find sponsors at `/discover?partners=1` with any other type.

### Signing up as a creator

Creators use the add-business quick start at `/add-business?as=creator`, worded for a person:

- "What do people call you?"
- "Where are you based?" City is optional. Without one, the page is Online.
- Main button: Message, Follow, or Work with me.
- Label: **Black Creator** ("I'm a Black creator") or **Ally Creator** ("I'm not Black, and I support Black-owned businesses and creators").
- "I'm 18 or older." The Terms already say 18+, and sign-up never asked until now.

The finish view adds a Creator details section (niche, platforms, audience size) and the partner switch. Social links are free on creator pages.

New creator pages go through the normal new-submission review.

### Home page

- A "Creators" chip in the hero.
- A Creators band after the Avenues. It shows the newest creators once at least 4 are published. Before that, it shows a "Creators, get listed" invitation, so it's never an empty grid at launch.
- A Creators tile in the Avenues (layout picked at the round-1 workshop).

## MVP vs later

| MVP (tickets 131 to 135) | Later |
|---|---|
| Creator type, category and filters | Messaging or collab request forms |
| Creator sign-up path with label + 18+ | "Looking for creators" posts (the `job` type could host them) |
| Free socials for creators; close the Links paywall hole | Live follower counts or platform API sync |
| Partner switch, filter and badges | Creator verification (for example, a code in your bio) |
| Home chip, band and tile | Niche and platform words in full-text search (filters cover it for now) |
| Moderation checks for creators | Creator invite links; a `/for-creators` page |

## Success looks like

- At least 10 creators publish within 30 days of launch.
- At least 20% of business pages that publish after launch turn on the partner switch.
- At least 5% of `/discover?type=creator` visits end in a contact tap on a creator page.
- Zero creator pages published without the person's own sign-up.

**Failure looks like:** the band still shows the invitation 60 days after launch, or creators sign up and get rejected for label or age problems more often than they publish.

## Assumptions

- Creators will add themselves without invites once the gate flips. (High risk. The fallback is the invitation band plus founder outreach that points people to sign-up.)
- A self-reported audience range is good enough for businesses to shortlist. Moderators check it is plausible against the linked profile.
- The existing contact button covers the contact need. No new message channel.

## Risks

| Risk | Kind | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Too few creators at launch, so the band looks empty | Product | High | Medium | Invitation fallback; no cards until 4 are published |
| A minor signs up | Data / legal | Medium | High | 18+ attestation, moderation check, Terms section; review before merge |
| Inflated audience ranges | Product | Medium | Low | "Self-reported" label; moderation plausibility check |
| Label misuse (Ally creator picks Black Creator) | Legal / trust | Low | High | Same moderation and report path as business labels; founder + legal sign-off on definitions |
| Free socials for creators reads as unfair to businesses | Business | Low | Low | Creators have no storefront; socials are their whole page. Decision logged. |
| The Links section already lets Free businesses add socials | Business | Already true | Medium | Ticket 133 closes it |

## Gaps found along the way (not fixed here)

- Self-listed pages stay `unclaimed`, so they can't reach Verified. This affects every self-listed page, not just creators. Logged for a separate ticket.
- The owner entitlement guard trigger is a denylist. That means `open_to_partnerships` is writable by owners with no change, which is what we want, but any future sensitive column needs adding to the guard.

## Gates

| Gate | What | Who |
|---|---|---|
| Copy | Label definitions, 18+ wording, the new `/terms#creator-listings` section | Founder sign-off + legal review before merge |
| GATE-DATA | Ticket 131 migration on staging, then prod | Founder runs the prod script; Claude reads back as anon |
| Design | Avenues tile layout, creator photo | Founder picks at the round-1 workshop |
| Merge / deploy | Every PR | Founder |

## Open questions

1. Which kept photo should front the Creators band, banner and tile? (Workshop.)
2. Avenues: a seventh tile, or swap the coming-soon Jobs tile? (Workshop.)
3. Should the partner switch appear in the business finish view for every type, or only types that sponsor (business, restaurant, vendor, service provider)? Default: every non-event, non-job type.
