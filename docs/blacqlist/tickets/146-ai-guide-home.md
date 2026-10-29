# Ticket 146: A visitor guide on the home page hero

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review
**Depends on:** 138 / 128 (the AI provider, spend ceiling, kill switch and audit log), 142 (search phase 2: `/search` and `/discover` params)
**Gates:** none in this PR. No migration, no new dependency. The guide sits behind `FEATURE_AI_GUIDE`, which is off unless set. Turning it on in prod is the founder's call and needs a redeploy.
**Decision record:** the founder asked for a guide on the home hero that lets a visitor say what they need in plain words and get real listings back. The build follows these calls:

1. **Plain words in, real listings out.** The model only maps the visitor's words to filters we already have (category, city, keywords, open now, one help page). It never writes text a visitor reads.
2. **Allow-lists from live data.** Categories and cities come from the database at request time. Anything the model returns that isn't on the list is dropped.
3. **Nothing is stored.** The visitor's words go to Anthropic to be understood and nowhere else. The audit row keeps no text.
4. **Plain search is always the way out.** Any failure sends the visitor to `/search?q=<their words>`.
5. **Name search stays.** It moves under the guide as "Or search by name".

---

## Why

Most people don't think in categories. They type "somewhere to get my hair braided near me tonight" and the search box matches names and words, so they get thin results or nothing. The guide turns those words into the filters the site already has, then shows the same cards Discover shows. Visitors find something faster, and the site does the sorting instead of them.

## Scope

In:

- **Flag.** `FEATURE_AI_GUIDE` in `lib/env.ts`, closed by default. With it off the hero renders exactly as before.
- **Hero layout with the flag on** (`components/home/HomeHero.tsx`): the headline, then the guide ("Tell me what you need", up to 200 characters, an **Ask** button), then a smaller "Or search by name" with the existing search bar, then the quick-filter chips. `app/page.tsx` reads the flag on the server and passes it as a prop. The hero photo stays the only preloaded image.
- **The guide** (`components/home/AiGuide.tsx`, client): results show inline under the box. Skeleton cards while it works, up to 6 `EntityCard`s, a one-line summary built from the matched filters, a **See all** link, and one help page link when the words point at one. An empty answer gets a short note and the See all link. A fallback answer sends the visitor to plain search. Results are announced through an `aria-live="polite"` region. Targets are at least 44px and it works at 375px.
- **Server action** (`lib/actions/ai/guide.ts`). Checks run in this order and every one fails to plain search:
  1. The flag is on.
  2. The AI kill switch is off.
  3. Turnstile: **skipped in v1** (see below).
  4. Rate limit, per IP: 5 a minute and 30 a day (bucket `ai_guide`).
  5. The monthly AI spend ceiling (`withinMonthlyCeiling`).
  6. The guide's own share: guide calls this month stay under 40% of the monthly call budget.
- Then the words are cleaned and redacted (emails, phone numbers and links never reach the model), the model is called on the fast tier, and its JSON answer is checked against the allow-lists.
- **Pure helpers** (`lib/ai/guide.ts`): the input rules, the allow-list filter, the answer parser, the summary, the See all link, the fallback link, the budget math and the mock mapper. Mock mode (no API key) is a fixed keyword mapper so dev and tests never call a model.
- **Audit row.** One `ai_generation_requests` row per model call: `agent_type = 'visitor_guide'`, no listing, no user, no text. The column has no CHECK, so no migration.
- **Privacy Policy.** One line in the AI section about the home page guide, and the Anthropic row in section 6 now names it.
- **Safety plan.** A "Visitor guide" section in `docs/blacqlist/ai/ai-safety-and-approval-plan.md`.

Out:

- Turnstile on the guide. It needs a widget on the home page, a single-use token per ask and a Cloudflare script on the busiest page. The per-IP caps, the 40% share and the monthly ceiling bound the cost instead. Revisit if the guide's share fills up from abuse.
- Chat, follow-up questions or any text the model writes for visitors.
- Saving what visitors ask, even anonymously. The guide does not write to the zero-result search log.
- Near You (location) in the guide.
- Sponsored cards in guide results. They're dropped so no sponsored impression is counted from the guide.

## Acceptance criteria

- **Given** `FEATURE_AI_GUIDE` is off, **when** the home page renders, **then** the hero is exactly the old one: headline, tagline, search bar, chips.
- **Given** the flag is on, **when** the home page renders, **then** the hero shows the headline, the guide, "Or search by name" with the search bar, and the chips, in that order.
- **Given** the flag is on, **when** a visitor asks "soul food in Atlanta open now", **then** up to 6 cards show, with a summary like `Showing Soul Food in Atlanta, open now.` and a See all link that opens the same filters.
- **Given** the model returns a category, city or page that isn't on the live list, **when** the answer is checked, **then** that value is dropped and the rest still works.
- **Given** the kill switch is on, the rate limit is hit, the ceiling is reached or the guide's share is used up, **when** a visitor asks, **then** they land on `/search?q=<their words>` with no model call.
- **Given** the model call fails or returns something that doesn't parse, **when** a visitor asks, **then** they land on plain search.
- **Given** any ask, **when** the request finishes, **then** no visitor text is in the database or the server logs.
- **Given** a keyboard or screen reader user, **when** they ask, **then** focus stays visible, the button is reachable, and the results are announced.

## QA notes

- Run with no `ANTHROPIC_API_KEY` first. The mock mapper answers "barber in atlanta", "soul food open now" and "how do I add my business" without a model.
- Check 375px: the box, the button and the cards fit with no sideways scroll.
- Turn the flag off and confirm the hero matches main.
- With the key on Preview, ask something with an email or phone number in it and confirm the answer still comes back and nothing is stored.
- Hit Ask 6 times in a minute from one IP. The sixth goes to plain search.
- The See all link goes to `/search` when there are keywords and to `/discover` when there are only filters. `/search` keeps its own anonymous zero-result log (ticket 142) once the visitor goes there.
- Param names: `q`, `category`, `city`, `open_now=1`.
