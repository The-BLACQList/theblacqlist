# Ticket 261: Cue Never Shows Its Working Notes

**Status:** PR open. Merge needs the founder's OK.

## Why
Founder, 2026-11-21: a Cue reply began with "Dropping the owner wording". That is the model talking to itself between tool calls. People should only see the answer.

Both prompts already say not to narrate. The model still does it sometimes, more often since ticket 256 raised the visitor Cue to medium effort. A prompt rule alone can't stop it, so the loop does.

## What Changed
`lib/ai/cue/loop.ts` (`runToolLoop`, shared by the visitor and owner Cue):
- Each model call's text is held until the call ends. It still goes through TextGuard first (links and phone numbers).
- Text from a call that looks something up is a working note. It is dropped from the screen and the saved reply.
  - Visitor lookups (`CUE_LOOKUP_TOOLS`): `search_listings`, `find_place`, `get_listing`.
  - Owner lookups (`OWNER_CUE_LOOKUP_TOOLS`): `get_my_page`, `get_help`.
- The text of the call that ends the turn is the whole reply.
- If that call writes nothing, the last text written next to a show-only tool (`show_businesses`, `page_action`, `draft_text`, `go_to`) is used, unless a tool had already failed by then. Failing that, the last working note is used.
- If a turn has no answer text at all, the last working note is used, so the reply is never empty.
- A broken tool input (`bad_json`) is always retried once, because nothing from the failed call was shown.

### Found on the Preview (first pass)
"lawyer in atlanta" still showed "The card display failed on the IDs, so I'll retry…" followed by a second answer. Search gives the model 8 results, but `show_businesses` took at most 6 and failed the whole call on 7, 8 or one garbled id.
- `show_businesses` now drops ids that aren't ids and keeps the first 6 it knows. The model is still told 6.
- The rule above (text after a failed tool is a note).
- Both prompts: "never mention tools, ids, retries or errors" (`CUE_CHAT@4`, `OWNER_CUE@3`).

### Found on the Preview (second pass)
No working notes on 4 questions, but "bathroom products" and "barber near Decatur" said the answer twice: once next to the cards, then again at the end. So the final call's text is now the whole reply, as first proposed on the 258 Preview card.

## Trade-off
The reply now appears when the last model call ends, instead of word by word. The status line ("Searching Atlanta…") still shows while Cue works. Replies are short (800 tokens max), so the wait is small.

## Tests
- `tests/cue-agent.test.ts`:
  - the founder's case: "Dropping the owner wording" next to a search is never shown or saved;
  - a note next to `find_place` is hidden;
  - text next to `show_businesses` is kept;
  - the last note is used when the final call is empty;
  - a broken call is retried even after it wrote text.
- `tests/cue-agent.test.ts` also: text next to failed cards, and the retry after them, is hidden; an answer written next to the cards and again at the end is said once; text next to the cards is kept when the final call is empty.
- `tests/cue-tools.test.ts`: 8 ids shows the first 6; a garbled id is dropped and the rest shown.
- `tests/owner-cue.test.ts`: a note next to `get_my_page` is hidden; the final call's words are the reply.
- Typecheck clean. Lint 0 errors (2 old warnings). Vitest: 5,793 passed.
