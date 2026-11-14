# Ticket 203: Cue for business owners, on the dashboard

**Phase:** V1.5 · **Priority:** P1 · **Status:** In progress
**Depends on:** 169 (Cue's streaming loop, guards and wire format), 138 (writing help: generate, allowance, approve and apply), part C (edit tabs and anchors)
**Gates:** no migration (`ai_generation_requests.agent_type` and `rate_limit_counters.bucket` have no CHECK). Behind `FEATURE_OWNER_CUE`, closed by default on every deployment. **Production waits for a Privacy Policy update (GATE-PUBLISH)**: the live policy covers writing help and the visitor Cue, but not an owner typing questions to a chat (see "Privacy" below). Turning it on is the founder's call and needs a redeploy.
**Plan:** owner-experience round 2, part E (`~/.claude/plans/i-clicked-send-message-snappy-sedgewick.md`).

**Decision record (founder, 2026-11-13):**

1. **A helper that also writes drafts you approve.** Cue answers how-to questions, reads the owner's own page and says what to improve, links to the right place to fix it, and drafts text the owner can use. It never changes anything by itself.
2. **The corner button, like customers have** (changed by the founder after trying the first build, 2026-11-13; it was "a side panel from the sidebar"). The same gold Ask Cue button sits in the bottom-right of every dashboard page. On a computer it opens a panel that stays open while the owner works; on a phone, a full-screen sheet. On the edit page the button and panel ride above the Save bar, so Save is never covered, and on a narrow phone the button shrinks to the Cue mark. It shows on Upgrade too, as a constant helper (founder, 2026-11-13, reversing the first build's "never on Upgrade"). With the Tester Tour showing, the tour keeps the corner and Ask Cue sits just above it.
3. **This reverses ticket 147's decision 6 for the dashboard only.** The visitor Cue (the gold corner button) stays hidden on the dashboard, admin, account, sign-in, checkout and forms. `lib/assistant/routes.ts` does not change. The owner Cue is a separate panel with its own route, prompt and tools.

---

## Why

Owners asked how to do things the dashboard already does (turn the inbox on, add a button, get found on Google), and the edit page has seven tabs. A helper that knows their page can say "your hours are missing" and take them straight to the Hours card.

## Scope

In:

- **Flag.** `ownerCue` (`FEATURE_OWNER_CUE`) in `lib/env.ts`, in `CLOSED_BY_DEFAULT`.
- **Route** `POST /api/cue/owner`, newline-delimited JSON like `/api/cue`. In order:
  1. a same-site JSON request of reasonable size;
  2. the input: a message of 1 to 300 characters, up to twelve earlier turns, and the page id the owner is on (optional);
  3. the flag, then the AI kill switch;
  4. a signed-in user (`getOwnerSession`) who owns at least one page;
  5. rate limit per user: 20 an hour, 100 a day (bucket `owner_cue`);
  6. paid calls only: the monthly ceiling, and the owner share (20% of the monthly call budget; one message counts as `cueMessageUnits()` calls, like the visitor Cue);
  7. one audit row: agent `owner_cue`, `listing_id` null (so a chat never uses up a page's writing allowance), `created_by` the owner, model, tokens and an outcome code. No text.
- **Tools** (`lib/ai/cue/owner/tools.ts`). Every tool that takes a page checks it is one of the caller's own pages, loaded with `owner_user_id = caller`.
  - `get_my_page(listing_id?)`: name, kind, plan, status, city, category, tagline, the first 500 characters of the About, counts (photos, services, hours, buttons), and what the strength meter says is missing, with where to fix each.
  - `get_help(topic)`: fixed help we wrote (`lib/ai/cue/owner/help.ts`): plans (read from `lib/stripe/plans.ts`), the edit page, photos, buttons, messages, Happening now, deals, Order on and Find us at, Google, verification, analytics, writing help, import from your website.
  - `draft_text(kind, listing_id?)`: About, search title or search description. Runs the writing-help path (`requestSuggestion`, shared with `generateSuggestionAction`): `aiBeta` on, the page owned, Starter or above, the monthly allowance and the daily cap. Makes a **pending** suggestion and returns it as a card.
  - `go_to(section, listing_id?)`: a link to an edit tab card or a dashboard page, from a fixed list. Never a free URL.
- **Draft card.** Shows the draft with "Use this" and "Not now". "Use this" asks first ("This replaces your current About"), then runs `approveSuggestionAction` then `applySuggestionAction`, the same two steps the edit page uses. "Not now" runs `rejectSuggestionAction`. Nothing reaches the page without that click.
- **Panel.** `components/dashboard/OwnerCue.tsx`, mounted by `app/dashboard/layout.tsx` behind the flag for owners with a page. It copies the visitor Cue's button and panel (`components/assistant/Assistant.tsx`): not modal on a computer, a sheet on a phone. Which page is open comes from `lib/ai/cue/owner/routes.ts`. Its corner position is `.owner-cue-pill` in `app/globals.css`: above the Save bar (`data-save-bar` in `ProfileSave.tsx`) and above the Tester Tour (`--tour-rail-stack`, written by `TourRail.tsx`). The chat lives in the browser tab only (`sessionStorage`) and clears on Clear chat.
- **Replies read easily** (founder, 2026-11-13, after the first Preview: "too long without space"). The prompt (`OWNER_CUE@2`) asks for a one-sentence answer first, numbered steps, bulleted lists for two or more things, paragraphs of at most two sentences with blank lines between, and under about 120 words. Words from separate model calls are separate paragraphs (`partBreak` in `lib/ai/cue/loop.ts`), never run together. `CueText` renders the paragraphs, lists and bold.
- **Agent.** `OWNER_CUE_AGENT` in `lib/ai/agents.ts` (routed, so the routing test covers it); the ceiling counts its rows in units, like the visitor Cue.
- **Mock.** With no key or no ceiling, a scripted stand-in runs the whole chat (tools, cards, links) for Previews and CI.

Out:

- Cue changing anything on its own, or applying a draft without the owner's click.
- Captions and analytics summaries in the chat (they have no field to apply to; the edit page and analytics page keep them).
- Saving the chat on our servers.
- The visitor Cue on the dashboard.

## Guards

- Reuses `lib/ai/cue/guard.ts`: the reply streams through `TextGuard` (no links, emails or phone numbers), then `cleanReply`. Links reach the owner only as `go_to` buttons we built.
- What the owner types and the earlier turns go through `sanitizeForPrompt`: emails, phone numbers, street addresses, links and the owner's own name (from their profile) come out before anything is sent.
- Page facts sent to the model are the owner's own page. Nothing about visitors, customers or messages.
- Tool results, page text and earlier turns are data, not instructions (said in the prompt).
- Nothing logs content.

## Privacy

The live policy (`/privacy#ai-writing-help` and `#cue`) covers drafts and the visitor Cue. It does not say that an owner's questions in a chat are sent to Anthropic. Proposed text for the next policy update, under "AI writing help":

> **Cue on your dashboard.** If you ask Cue on your owner dashboard, we send your question and your last few messages to Anthropic, along with your page's details (such as its name, plan, tagline, About text and what's missing), so it can answer and suggest what to improve. Before we send anything, we take out anything that looks like an email address, a phone number, a street address, a link, or your name. Drafts Cue writes are saved as suggestions, like other writing help, and nothing goes on your page until you choose "Use this". Your conversation stays in your browser tab and clears when you close it. We keep a record that Cue was used (when, whether it worked, and how much AI it used), not what you typed.

Until that text is posted and in effect, `FEATURE_OWNER_CUE` stays unset in production.

**Update 2026-11-13:** the flag was switched on in production with PR #331, before this text was posted. The text is now written as its own section, `/privacy#owner-cue` (not under "AI writing help"), and the panel's Privacy link points there. Review note and the gap (O1): `docs/blacqlist/legal/owner-cue-policy-update-2026-11.md`.

## Tests

- Input schema: lengths, history cap, a page id that isn't a uuid.
- Tools: a page that isn't the caller's is refused by every tool; `go_to` only builds links from the fixed list; `draft_text` returns a pending suggestion and never calls apply.
- Route contract: flag, kill switch, sign-in, rate limit windows and the audit row's `listing_id: null` are all in the route.
- Agent routing: `owner_cue` is routed; the ceiling counts its rows in units.
- The visitor Cue's hidden routes are unchanged.

## Done when

- An owner on a Preview with the flag on can ask "how do I get more views", see what their page is missing, follow a link to Hours, and use an About draft after confirming.
- A Free page gets an honest "writing help comes with Starter" and a link to Upgrade.
- Typecheck, lint and unit tests pass.
