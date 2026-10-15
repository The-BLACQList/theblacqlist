# Ticket 138: Writing help inside Edit content (retire the AI Suggestions page)

**Phase:** V1.5 · **Priority:** P1 · **Status:** Ready after #235
**Depends on:** #235 (real model, monthly allowance, $30 ceiling), 129 (shared finish view on every owner edit)
**Gates:** none new. No migration: `ai_suggestions` already has `status`, `metadata`, `reviewed_by`, `reviewed_at` and `applied_at`. The same AI launch gates still apply (`FEATURE_AI_BETA`, the prod key no earlier than the privacy notice date).
**Decision record:** on 2026-10-15 the founder asked to fold AI suggestions into Edit content and picked concept A ("right under the field") in the design workshop. Canvas: https://claude.ai/artifact/UQnJBMgm5dmvD1f6aVz2o9. There were four answers:

1. **Use this, then Save.** Use this puts the draft in the field. The section's normal Save makes it live. Approved and applied are still recorded behind the scenes.
2. **Explain my numbers** (`analytics_explainer`) moves to the Analytics page.
3. The button says **"Write one for me"**, with no "AI" label.
4. **Show the allowance** ("8 of 10 left this month") at the top of the page. The daily limit shows only when an owner hits it.

---

## Why

Right now owners write their page in one place (`/dashboard/pages/[id]/edit`) and ask for help in another (`/dashboard/pages/[id]/ai-suggestions`). On the second page they approve, then apply, and only then walk back to Edit to see what changed. The flow has three problems:

- The draft is far from the field it is meant for.
- It takes two steps (approve, then apply) to do one thing.
- The text goes live with no chance to edit it first.

The edit page already has the page strength meter, a live preview and an unsaved-changes guard. Help belongs there.

## Defaults (from the chosen mockup)

- One suggestion card per field at a time. A new request replaces the card. The old suggestion stays `pending` in the table and expires on the existing schedule.
- When the page loads, the newest `pending` or `approved` suggestion for each field shows under that field. Nothing an owner asked for on the old page is lost.
- **Not this** hides the card and opens an optional **Why not?** box with **Send** and **Skip**. Either button records the suggestion as rejected. Send also saves the reason.
- Captions are copy-only: **Copy caption** and **Not this**. They are never saved to the page.

## Scope

In:

- **Allowance strip** at the top of Edit content: "**Writing help** · N of M left this month", plus a **How** link that opens the how-it-works note inline.
  - N is `aiQuota(tier)` minus `countSuccessfulLast30Days(listingId)`.
  - At 0 the strip says "No drafts left this month. More on [date]." and every Write button is disabled with that reason next to it.
- **Write buttons**, each sitting right under its field:

  | Section | Button | Agent | Field |
  |---|---|---|---|
  | Story | Write one for me | `listing_description` | business description |
  | How you show up on Google | Write a search title | `seo_coach_title` | `meta_title` |
  | How you show up on Google | Write a search description | `seo_coach_description` | `meta_description` |
  | Social links | Write an Instagram caption | `social_caption_instagram` | none (copy-only) |

- **Loading:** "Writing a suggestion. You can keep editing." with a skeleton, in a `role="status"` region. Other sections stay usable.
- **Suggestion card** under the field. It shows the **Suggested** badge, a **Sample** badge when `metadata.provider === 'mock'`, the text and a character count, then the buttons **Use this**, **Try again** and **Not this**.
- **Use this:**
  - Puts the text in the field through the view's existing draft state, so the live preview and the "Not saved yet" line update right away.
  - Under the field: "Not saved yet. Read it over, then save." and **Put mine back**, which restores the owner's earlier text.
  - Nothing reaches the public page until the owner saves that section.
- **On save:** the form sends a hidden `ai_suggestion_id`. After the content save succeeds, the server:
  - moves that suggestion to `applied`, setting `reviewed_by`, `reviewed_at` and `applied_at`
  - records `metadata.edited_before_save` (true or false)
  - only does this if the suggestion belongs to this listing and is `pending` or `approved`
  
  A failure here never blocks or undoes the owner's save.
- **Status line after saving:** "Search title saved. It's on your page now." with a green check, in `role="status"`.
- **Not this:** runs the existing `rejectSuggestion` with the optional reason, capped at `MAX_REASON_CHARS`. The card closes and leaves "Your box above is unchanged."
- **Limits:**
  - **Daily limit hit** (10 per page per day): a grey box in that section says "That's 10 drafts for this page today. You can ask again tomorrow. You still have N left this month." The Write buttons are disabled.
  - **Monthly limit hit:** the strip message above.
  - **Spending ceiling hit:** "Writing help is paused for now. Try again later." It must not mention money.
  - **Output check failed:** "That suggestion didn't pass our checks, so we threw it away. Try again or write your own."
- **Locked states** (the C-phone board on the canvas):
  - **Free:** the strip becomes "Writing help comes with Starter. See plans." There are no Write buttons and no locked buttons.
  - **Beta off:** no strip and no buttons, so the page looks like it does today.
- **GoogleCard:** its rules-based "Use this" now fills the fields and waits for Save, the same as AI suggestions. Today it saves right away. After this change **Use this** means one thing everywhere.
- **Closing note** at the bottom of the form: "You decide every word. A suggestion reaches your page only when you tap Use this and then save."
- **Analytics page:** an "Explain my numbers" card runs `analytics_explainer`. Owners see it only when the listing can use both analytics and writing help. The result is read-only ("Just for you. Nothing to apply.") and uses the same allowance.
- **Retire the old page:**
  - `/dashboard/pages/[id]/ai-suggestions` redirects (308) to `/dashboard/pages/[id]/edit`.
  - Remove the "AI Suggestions" sidebar link (`DashboardSidebar.tsx`).
  - In `lib/actions/ai/*`, every `revalidatePath` that points at the old page now points at `/edit` (or `/analytics` for the explainer).
  - Update the header comment in `lib/ai/checklist.ts`.
  - The score and checklist from the old page already live in `StrengthMeter`. Confirm every checklist item appears there before deleting the old page.

Out:

- AI drafts in /add-business (ticket 128). That ticket reuses this card and these rules.
- Tagline, offerings and tag suggestions. No agent exists for these, and tags stay "from sources only".
- Any new agent, prompt change, model change or price change.
- Bulk "write everything for me".

## Data

| Thing | Where | Change |
|---|---|---|
| Suggestions | `ai_suggestions` | None. Uses the existing statuses and `reviewed_*` / `applied_at` columns, and `metadata.rejection_reason` / `metadata.edited_before_save` |
| Monthly allowance | `aiQuota(tier)` + `countSuccessfulLast30Days` | A new read helper for the strip. No new table |
| Daily limit | `RATE_LIMIT_PER_LISTING_24H` | None. Read it to show the box only when the limit is hit |
| Audit | `ai_generation_requests` | None. Still written before every call. Never log prompt or response text |

## Acceptance criteria

- Given a Starter owner with beta on, when they open Edit content, then they see the allowance strip and a Write button under the description, search title, search description and Instagram fields.
- Given they tap Write one for me, then a suggestion card appears under the description, with a Sample badge in mock mode.
- Given they tap Use this, then the description field holds the suggestion, the preview shows it and "Not saved yet" appears. Given they then tap Put mine back, then their old text returns.
- Given they used a suggestion and saved the section, then the public page shows the text and the suggestion row is `applied` with `applied_at` set. Given they edited the text before saving, then `metadata.edited_before_save` is true.
- Given they used a suggestion and left without saving, then the leave guard asks first and nothing changes on the public page.
- Given they tap Not this and send a reason, then the row is `rejected` with the reason in `metadata`, and the field is unchanged.
- Given 10 requests today on this page, then the daily box shows in that section and all Write buttons are disabled. Given drafts are used up for the month, then the strip says so and names the reset date.
- Given a Free listing, then there are no Write buttons and the strip offers Starter. Given beta is off, then there is no strip and no buttons.
- Given a pending suggestion from before this change, when the owner opens Edit, then it shows under its field.
- Given a visit to `/ai-suggestions`, then it redirects to `/edit`, and the sidebar no longer lists AI Suggestions.
- Given an Analytics-eligible listing with writing help, when the owner taps Explain my numbers, then a read-only summary appears there and the allowance drops by one.
- GoogleCard's Use this fills the fields and does not save until the owner saves.
- No `console.*` in `lib/ai`. No prompt or response text in any log.
- Accessibility:
  - Loading and results are announced through `role="status"`, and errors through `role="alert"`.
  - Focus moves to the card when it appears, and back to the Write button when it closes.
  - Every button is at least 44px tall, and the Why not? input has a visible label.
  - The badges carry text, not only color.
- At 375px, cards stack under their field with full-width buttons, and the sticky Save bar never covers a card's buttons.
- Tests:
  - unit tests for the allowance helper and the save-time `applied` step: wrong listing, wrong status and failure never block the save
  - component tests for Use this / Put mine back / Not this
  - e2e: request, Use this, save, public page shows the text (mock provider)
