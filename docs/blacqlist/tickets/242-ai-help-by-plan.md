# Ticket 242: AI Help by Plan

**Status:** Merged #381 (536c23b) 2026-11-21. Migration `20261204000000_ai_suggestion_types_242.sql` live on staging and prod. Privacy wording approved by the founder 2026-11-21 and live ("Last updated" November 21, 2026).

## Why
The plan cards said "AI writing help: 10 / 100 / 500 drafts every 30 days". That is a number nobody shops for, and it didn't say what the help does. Founder, 2026-11-21: each plan lists the jobs AI does for you, with smaller and realistic limits. No name for the helper in plan copy (no "Cue"), and never the word "drafts".

## What Changed

### Plan copy (`lib/stripe/plans.ts`)
- Starter: "AI help with your page text, Instagram captions, review replies, and Happening now posts, plus a monthly read of your numbers".
- Growth: "AI help with product, service, event, and job descriptions too".
- Premium: "The most AI help of any plan".
- The number sits in each card's small print, read from `aiQuota()`: "AI help up to 20 times a month per page." Growth says "(Starter has 20)" and Premium says "(Growth has 50)".
- The same wording is used on /pricing (cards and FAQ), Upgrade, the compare grid, the dashboard card, the page editor's writing help, and the owner help answers.

### Limits (`lib/stripe/features.ts`)
- 20 / 50 / 100 a month per page (it was 10 / 100 / 500). The daily cap of 10 per page stays.
- The allowance shown on screen now leaves out the /add-business onboarding suggestions (`lib/ai/allowance.ts`), the same way the limit check already did. The number shown and the limit now agree.

### Five new jobs (`lib/ai/agents.ts`)
| Job | Where | Plan | Gate |
|---|---|---|---|
| Review reply | Your page, under each review (Post Response form) | Starter and up | `ai_suggestions` |
| Happening Now post | Dashboard, Posts | Starter and up | `ai_suggestions` |
| Product or service description | Page editor, Services | Growth and up | `ai_item_writeups` (new, tier 2) |
| Event description | Event editor, About This Event | Growth and up | `ai_item_writeups` |
| Job description | Job editor, About This Role | Growth and up | `ai_item_writeups` |

- Every agent has `applyTarget: null`. **Use This** fills the form box only. Nothing is saved, posted or sent until the owner presses the form's own Save, Post or Post Response button. The help card (`components/ai/ItemWriteHelp.tsx`) never calls a submit, approve or apply action, and a test checks that.
- Button labels never say "AI": "Write a reply for me", "Write a post for me", "Write a description for me".
- A Starter page sees "AI help with this comes with Growth. See Plans" under Growth jobs, but only while Growth is open. A Free page sees "AI help comes with Starter. See Plans". With AI switched off, nothing shows.
- The server makes the same check (`lib/ai/requestSuggestion.ts`) and gives the same wording.
- Not wired:
  - Marketplace product and service forms, because the marketplace is off.
  - The /offerings page (events and jobs only), because the editor forms above cover it.

### What the browser may send (`lib/ai/itemFacts.ts`)
- A review is named by its id only. The server loads the review's rating, title and body, but only when the review belongs to this page and is published. It never loads the reviewer's name or account.
- For the other jobs:
  - The server reads what the owner has typed so far.
  - It keeps only the known fields, trims each one and caps its length (name 120, short fields 80, notes 600, review text 1,500).
  - It removes email addresses, phone numbers, street addresses and the owner's own name, plus bracket characters so the text can't break out of the prompt.
- Job pay goes in only as the owner typed it.

### Database
- `20261204000000_ai_suggestion_types_242.sql` adds `post_text`, `event_description` and `job_description` to the `ai_suggestions.suggestion_type` check. It is additive and has a DOWN PLAN.
- `offering_description` and `review_response` were already allowed.

### Why Use This doesn't mark the suggestion used
`approveSuggestionAction` refreshes the editor page, which would wipe what the owner has typed in the rest of the form. So the suggestion stays pending, like a suggestion the owner ignored. Not This with a reason still records the rejection. If we want a "used" count later, add an approve that doesn't refresh.

## Privacy (Founder Approved 2026-11-21)
Review replies send a customer's review text to Anthropic. Today's policy (`app/(public)/privacy/PrivacyPolicy.tsx`, "AI Writing Help") covers only the owner's own business information, and it says text is cut to 500 characters. Proposed changes. This is plain wording, not legal advice:

1. In "AI Writing Help", after the list of what a draft can include, add: "It can also suggest a reply to a review on your page, a Happening Now post, or a description for a product, service, event or job."
2. In "What we send", add: "If you ask for help replying to a review, we also send that review's star rating, title and words. We never send who wrote it."
3. Change "we cut them to 500 characters" to "we cut them to a set length".
4. Under what we collect, after "Reviews and community content you submit" (there is no section for reviewers on their own), add: "If the business asks for help writing a reply, the words and star rating of your review (not your name) are sent to Anthropic to suggest that reply. Nothing is posted until the business owner reads it and posts it."
5. In the service-provider table row for Anthropic, add "replies to reviews" to the list of what the writing help suggests.

The policy's own rule is that new legal wording goes in an `isNext` block, which counsel reviews before the notice email goes out. That update has been in effect since October 16, 2026, so these lines are live text. The notice email is held, as with tickets 230 and 234.

The Terms (`TermsOfService.tsx`, "AI writing help") already cover AI help in general, and no change is proposed there. If the founder wants a notice email for this change, it goes through the existing policy-update notice.

## Tests
- New: `tests/ai-help-by-plan.test.ts` (24 tests). It covers:
  - which plan each job comes with, and that the gate map matches the registry;
  - the locked and hidden states;
  - the 20 / 50 / 100 limits, and onboarding suggestions left out of the count;
  - what the browser may send;
  - that the review prompt has no contact details and no author;
  - that every prompt fits the length cap;
  - that sample text is valid;
  - the post split;
  - that the migration covers every suggestion type;
  - that the card never submits;
  - that labels never say "AI";
  - the owner help text.
- Updated:
  - `plan-copy` (the jobs line, the small print, never "drafts" or "Cue");
  - `ai-quota` and `feature-gating` (new limits);
  - `ai-writing-help`.
- Typecheck is clean. Lint has 0 errors (the 2 warnings were already there). Vitest: 5,544 passed.

## Preview Checks (2026-11-21)
Passed:
- A Free event page shows "AI help comes with Starter." A Starter event page shows "AI help with this comes with Growth." and no write button.
- A Starter page's Services tab shows the Growth note.
- The review on the public page has the "Write a reply for me" button after Respond as Owner. No sideways scroll at 390px.
- The post and job forms have their write buttons.
- /pricing shows the 20 / 50 / 100 small print and "review replies", with no "drafts".
- /privacy shows the new lines and the November 21, 2026 date.

Blocked, not by this ticket:
- Every AI request on Preview fails with `provider_error` from Anthropic. The forms show "Couldn't write a suggestion right now. Try again." and nothing changes.
- Other agents fail the same way, and the last successful call on staging was 2026-11-14. This needs a check of the Preview Anthropic key or credit.
- So write → Use This → Put Mine Back was not seen end to end on Preview. The unit tests cover it with sample text (the card never submits; Put Mine Back restores the owner's text).
- A local run with sample text couldn't sign in, because the Preview Supabase settings can't be downloaded.

Staging QA data was put back afterwards: the job's and event's owners, the event's tier and the job's hiring page were restored, and the test review was deleted. The failed request rows were left as the audit trail.

## Still To Do
- ~~Prod migration at merge.~~ Done 2026-11-21.
- The Anthropic keys were reset 2026-11-21 and a Preview post write was seen working. Still to see by hand: write one review reply and one post, and check that nothing posts until Post Response or Post.
