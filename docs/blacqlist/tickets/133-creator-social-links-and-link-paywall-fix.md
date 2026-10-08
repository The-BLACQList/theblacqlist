# Ticket 133: Free social links for creators, and close the Links paywall hole

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready
**Depends on:** 131 (creator type), 119 (plan limits)
**Gates:** none. No migration.
**Decision record:** `docs/blacqlist/features/creators-and-influencers.md`

---

## Why

`[Decision — founder, 2026-10-08]` Social links are free on creator pages. Businesses stay on Starter. For a creator, socials are the whole point of the page.

While planning this we found a hole: `lib/actions/dashboard/addListingLink.ts` has no plan check, so a Free business page can add Instagram or TikTok as a link row and get around the Starter social gate.

## Scope

In:

- Creators add social links on every plan.
- Socials count as a way to reach a creator in the page-strength checklist.
- `addListingLink` applies the social check to social link types.

Out:

- Removing links Free businesses already added through the hole. They keep them until they remove them, same as other plan changes.
- Any change to business social pricing.

## How it works

| Need | Where |
|---|---|
| Allow socials when `entity_type === 'creator'` | `checkSocialLinks` in `lib/stripe/planChecks.ts` |
| Keep the section unlocked for creators | `SocialSection` |
| Count socials as reachable for creators | `isReachable` in `lib/ai/checklist.ts` |
| Same social check on social `link_type`s; creators allowed | `lib/actions/dashboard/addListingLink.ts` |

Non-social link types (menu, booking, website) keep today's rules.

## Acceptance criteria

- Given a Free creator page, when the owner adds Instagram, TikTok or YouTube, then it saves and shows on the page.
- Given a Free business page, when the owner tries to add Instagram through the Social section, then they see the Starter upgrade note (unchanged).
- Given a Free business page, when the owner tries to add an Instagram link through the Links section, then the server refuses it with the same upgrade message.
- Given a Free business page, when the owner adds a non-social link, then it saves as it does today.
- Given a Starter business page, then socials save through both sections.
- Given a Free creator page with socials and no phone or website, then the checklist counts it as reachable.

## Known limits

- Free business pages that already used the hole keep those links.

## QA notes

- Unit: `checkSocialLinks` and `addListingLink` by type and plan (creator Free, business Free, business Starter); `isReachable` for creators.
- Browser: try the Links section as a Free business with an Instagram URL; confirm the message is plain and the form keeps its input.
