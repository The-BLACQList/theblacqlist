# Title Case: house style

**Owner:** founder · **Decided:** 2026-11-13 (headings), 2026-11-14 (buttons, then sitewide) · **Ticket:** [205](../tickets/205-title-case.md)

The BLACQList writes its titles, headings, buttons, nav, tabs, badges and form field labels in Title Case: "Add a Listing", "Claim a Business", "Where Else to Find Us", "Read Our Story".

## What gets Title Case

- Page titles (`metadata.title`, `openGraph.title`) and email subject lines.
- Headings h1–h4, card, dialog and sheet titles, section eyebrows, and email sub-heads.
- Buttons, links styled as buttons, and email buttons.
- Nav, footer and menu links, tabs and segmented controls.
- Badges, status pills and form field labels.

## What stays as written

- Running sentences, helper text, hints and placeholders.
- Headings that are a full sentence ending in a full stop ("Your claim for Mama's Kitchen is approved.").
- Anything an owner, reviewer or the database supplies: business names, post, offer, event, product and review titles, and category names stored in the database. The site never rewrites them.
- First-person choices read as a sentence ("I come to them" in a role picker), and checkbox, radio and switch options ("Open to brand deals"). They are listed in `scripts/title-case-allowlist.json`.
- Text CSS already shows in capitals (`uppercase`) may stay as it is in source.

## The rule

1. Capitalize the first word, the last word and every main word: nouns, verbs, adjectives, adverbs and pronouns ("Your", "Our", "It", "Me").
2. Keep these lowercase unless they come first or last: a, an, the, and, but, or, nor, for, so, yet, as, at, by, in, of, off, on, per, to, up, via, with, from, into, over, vs.
3. Capitalize the particle of a phrasal verb: "Sign In", "Log Out", "Set Up", "Pick Up Where You Left Off". After an ordinary verb the preposition stays lowercase: "Open in Maps", "Show on Map".
4. After a colon, dash, question mark or `|`, start again: "Search: A Fresh Start", "Receipts — A Guide".
5. Capitalize each part of a hyphenated word, except a minor word in the middle: "Black-Owned", "Sign-In", "Link-in-Bio", "Up-to-Date".
6. Brand and product spellings never change: The BLACQList, BLACQLight, The Collective, iOS, Wi-Fi, 24/7, FAQ, URL. "The" stays capitalized in "The BLACQList" and "The Collective".
7. Units after a number stay lowercase: "Within 5 mi", "10 min".
8. A question heading takes Title Case too: "What Do People Call You?".

| Before            | After             |
| ----------------- | ----------------- |
| Add a listing     | Add a Listing     |
| Saved businesses  | Saved Businesses  |
| Sign in           | Sign In           |
| See it on the map | See It on the Map |
| Find us at        | Find Us At        |
| Last 30 days      | Last 30 Days      |

## Tools

- `lib/text/title-case.ts`: `toTitleCase` and `isTitleCase`, the one implementation of this rule.
- `npx tsx scripts/check-title-case.ts` lists labels that break the rule. `--fix <path>` rewrites them in place; review the diff.
- `tests/title-case-guard.test.ts` runs in the unit gate and fails on a new sentence-case label. A label that is really a sentence goes in `scripts/title-case-allowlist.json` with a reason.

The scanner cannot see everything. Write these in Title Case by hand:

- Template literals with a `${value}` (```Show All ${n} Services` ``).
- Labels returned from a function or kept in a variable before use.
- Text in a `<span>` inside a button.
- Body copy that names a button should match it: "Tap **Report a Problem**".
