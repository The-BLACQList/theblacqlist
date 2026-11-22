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
- Text from a call that only shows something (`show_businesses`, `page_action`, `draft_text`, `go_to`) or ends the turn is the answer, and is shown.
- If a turn has no answer text at all, the last working note is used, so the reply is never empty.
- A broken tool input (`bad_json`) is always retried once, because nothing from the failed call was shown.

## Trade-off
Answer text now appears when each model call ends, instead of word by word. The status line ("Searching Atlanta…") still shows while Cue works. Replies are short (800 tokens max), so the wait is small.

## Tests
- `tests/cue-agent.test.ts`:
  - the founder's case: "Dropping the owner wording" next to a search is never shown or saved;
  - a note next to `find_place` is hidden;
  - text next to `show_businesses` is kept;
  - the last note is used when the final call is empty;
  - a broken call is retried even after it wrote text.
- `tests/owner-cue.test.ts`: a note next to `get_my_page` is hidden; separate calls still become paragraphs.
- Typecheck clean. Lint 0 errors (2 old warnings). Vitest: 5,747 passed.
