# Ticket 147: A site assistant that stays with the visitor

**Phase:** V1.5 · **Priority:** P1 · **Status:** In progress
**Depends on:** 146 (the home guide: allow-lists, name search, Near me, budget share), 142 (place lookup), 138 / 128 (provider, ceiling, kill switch, audit log)
**Gates:** none in this PR. No migration (`ai_generation_requests.agent_type` and `rate_limit_counters.bucket` have no CHECK), no new dependency. Behind `FEATURE_AI_ASSISTANT`, off unless set. Turning it on in prod is the founder's call and needs a redeploy. The Privacy Policy change is posted with the merge; a notice email is GATE-COMMS and waits for the founder's word.
**Decision record (founder, 2026-10-29):**

1. **One answer engine, two places.** A gold "Ask" button in the bottom-right corner of every public page opens the assistant: a side panel on a computer, a full-screen sheet on a phone. On the home page the bar answers on the page, with a "Keep chatting" link that opens the corner assistant with the same conversation.
2. **Big asks become a list.** "Plan a party in Detroit with Black-owned vendors" becomes the things that plan needs (catering, a DJ, a venue and so on), each with the top 3 by rating and a See all link, then "Your list" with Copy list.
3. **Honest about gaps.** When we list nothing for a need, the answer says so in fixed words and offers what we do list: a close kind of business in the same city first, then the same thing in the nearest city we cover. A place we don't cover at all ("Thai food in Alaska") gets "We don't list businesses in Alaska yet." and the nearest city for each need.
4. **The AI writes short need names only.** Every other word is fixed text we wrote, and every business comes from our own search.
5. **The chat is kept in this tab only** (`sessionStorage`), cleared when the tab closes or on Clear chat. Nothing is saved on our servers.
6. **Public pages only.** Hidden on the dashboard, admin, account, sign-in, checkout and forms.

This reverses three of ticket 146's Out items: follow-up questions (the last 3 messages go with each ask), text the model writes (need names only, format-checked), and location (Near me, search only).

**Ladder order, a note for the founder.** The plan said "same thing, nearest city" first. For a city we cover, the build tries a close kind in the same city first: someone planning a party in Detroit is better served by a Detroit dessert shop than a Chicago bakery. For a place we don't cover, nearest city is the only step. Say the word and the order flips.

---

## Why

The home guide answers one need at a time and disappears when the visitor leaves the home page. Visitors with a plan ("a party", "moving to Houston") need several kinds of business, and they need help on the page they're on. When we list nothing, a blank result loses them; an honest "not yet" plus the closest real option keeps them.

## Scope

In:

- **Flag.** `FEATURE_AI_ASSISTANT` in `lib/env.ts`, closed by default.
- **Pure rules** (`lib/ai/assistant.ts`): input schema (message up to 200 characters, the last 3 earlier messages, an optional Near me point rounded on the server), the prompt (4000 characters or fewer, top-level categories only if the full list doesn't fit), the answer parser and allow-list, the need-name check, the weighted rating, the fixed wording, the mock planner.
- **Server action** (`lib/actions/ai/assistant.ts`, `askAssistant`). Checks in the guide's order: input, flag, kill switch, rate limit per IP (8 a minute, 40 a day, bucket `ai_assistant`), then for paid calls the monthly ceiling and the shared visitor share (guide and assistant calls together stay under 40% of the monthly call budget). One model call per ask, no tool loop.
- **What the model returns:** `city` (a code), `place` (a place they typed that isn't a code), up to 6 `needs` (`name`, `category` code, up to 3 `keywords`, `open_now`) and `page`. Need names must match `^[A-Za-z0-9 &'-]{2,40}$`; a name that fails falls back to its category's name, and the need is dropped if it has neither. Keywords must be words the visitor typed or words in the need name, one word each, 20 letters or fewer. They go to search only.
- **Search for each need**, in parallel: our listings query with the need's filters. The assistant asks search for organic results only (`noSponsored`), so paid slots never appear and never inflate a count. If keywords plus a category find nothing, it tries again without the keywords. A top-level category from the model (Food & Dining) is first narrowed to the subcategory that fits the need (a cake becomes Bakeries & Pastry Shops), so a whole group is never offered as a match. Results are ranked by a weighted rating, `(n / (n + 3)) * avg + (3 / (n + 3)) * 4.0`, so one 5-star review doesn't beat 200 reviews at 4.8. Unrated listings come after rated ones, in search order. Top 3 per need; a single need shows up to 6, like the guide.
- **When a need finds nothing:** close kinds in the same place, then the same kind in the nearest city we cover that has it (the three nearest cities are tried), then "Not on The BLACQList yet." Close kinds are a hand-picked list (`CLOSE_KINDS` in `lib/ai/assistant.ts`): up to two sibling subcategories per subcategory (a bakery gets cafes and catering, never a grocery store). A kind with no entry skips the close step. The line names the kinds and sums their counts: "No Cake in Detroit yet. Close to it: Cafes & Coffee and Catering (3)".
- **Places.** Our own city and state names are read from the words first (`findPlaces`), then the model's `place`, then OpenStreetMap through the existing place lookup and its shared limit.
- **Name search.** Same as the guide: businesses whose name holds the typed words show first under "Matching names".
- **Chat store** (`lib/assistant/store.ts`): `sessionStorage` key `blq-assistant-v1`, last 20 turns, every read and write in try/catch so it works without storage.
- **UI** (`components/assistant/`): the mount (public pages only), the Ask button (gold, the brand mark, 44px or taller, lifts over the quick bar), the panel and sheet (Clear chat, close, three example prompts, a conversation list (an `<ol aria-label="Conversation">`, not `role="log"`, so each new answer is not read in full), a `role="status"` line), need groups, Your list with Copy list, and loading, error and rate-limited states. The tour rail moves up a step when the assistant is on.
- **Home.** With the assistant on, the guide calls `askAssistant` and shows the same need groups, plus "Keep chatting".
- **Typed "near me".** Typing "near me" (or nearby, closest) without tapping Near me asks the browser for a position, on the home bar and in the corner panel. If the visitor says no, the answer covers every city and opens with a fixed line: "We couldn't see your location, so these are from every city we list. Tap Near me or name a city to narrow it."
- **Phone map.** On `/map` at phone width the Ask button rides above the card sheet (the sheet publishes its height as `--map-sheet-h`), so it never covers a card.
- **Privacy Policy.** The guide paragraph becomes "The AI assistant", covering history, the tab-only chat and Near me.
- **Safety plan.** A "Visitor assistant" section in `docs/blacqlist/ai/ai-safety-and-approval-plan.md`.

Out:

- Saving conversations, even anonymously.
- Any text the model writes beyond need names.
- Tool loops or more than one model call per ask.
- The assistant on signed-in tools, forms or checkout.
- Turnstile (same reasoning as 146).

## Acceptance criteria

- **Given** the flag is off, **when** any page renders, **then** there is no Ask button and the home guide works as in 146.
- **Given** the flag is on, **when** a public page renders, **then** the gold Ask button shows bottom right; on the dashboard, admin, account, sign-in, checkout and add-business pages it doesn't.
- **Given** "plan a party in Detroit with all Black-owned vendors", **when** the visitor asks, **then** they get up to 6 needs, each with up to 3 Detroit businesses ranked by weighted rating, a count and See all, and Your list marks each need found, close or nearest, or not listed.
- **Given** "Black-owned Thai restaurant in Alaska", **when** the visitor asks, **then** the answer opens with "We don't list businesses in Alaska yet." and shows the nearest city that has one, or "Not on The BLACQList yet."
- **Given** an earlier "party in Detroit", **when** the visitor asks "what about DJs?", **then** the answer is DJs in Detroit.
- **Given** the model returns a need name with a link, a dot or 41 characters, **when** the answer is checked, **then** the name is replaced by the category name or the need is dropped.
- **Given** the kill switch, the rate limit, the ceiling or the shared share, **when** a visitor asks, **then** they get the fixed line and a "Search for" link, with no model call.
- **Given** any ask, **when** it finishes, **then** no visitor text is in the database or the server logs, and the chat lives only in that tab.
- **Given** a phone at 375px, **when** the assistant opens, **then** it is a full-screen sheet with focus held inside, and Esc or Close returns focus to the button.

## QA notes

- Mock mode (no key) plans "party in Detroit", "wedding in Atlanta" and "barber near me" without a model.
- Ask 9 times in a minute from one IP: the 9th gets the rate-limited line.
- Check the button against the listing quick bar, the map controls and the tour rail at 375 and 1280px.
