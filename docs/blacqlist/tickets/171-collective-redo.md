# Ticket 171: The Collective redo, every business on the map and a smaller hero

**Phase:** V1.5 · **Priority:** P1 · **Status:** In review (draft PR)
**Depends on:** 161, 167 (both live).
**Gates:**
- GATE-DEPLOY: merge waits on the founder's word.
- No migration and no new dependency.

**Decision record:**
- Founder, 2026-10-31, on the live /flow-map, with two screenshots:
  - "all in the screenshot can go. Put it in the privacy policy or something."
  - "I do want the business nodes on the collective. No connections will appear until receipts are uploaded. This way we can still see the distribution of businesses."
  - "The top area is far too large and needs to be collapseable"
  - "The Silo" becomes "The Collective".
  - Match round 17 (https://claude.ai/artifact/HnNKpmGYQ3MKHFyaeav8fd, concept D, HUD B), "everything else about that design was spot on", but leave out the "BLACQWeb" text in the centre.

---

## Why

The live page showed an empty silo until receipts were counted. Four cards under the map pushed it down, and the hero filled the first screen on a phone. The founder wants to see how businesses on the list are spread out from day one, with lines arriving as receipts are counted.

## What changed

**Every business is a dot.**
- `/flow-map` reads every published listing (not events or jobs, up to 2000). It also reads every listing with counted receipts separately, so a counted business always shows even past the cap.
- `buildSiloBusinesses` returns every listing. `linked` is true only when the node clears `AGGREGATE_MIN_TRANSACTIONS`.
- An unlinked business carries no amount and no count to the browser. It has no line and no total. Its card says "Not enough receipts counted here yet to show a total."
- The list view, the ticker and the link count only use linked businesses.
- Names stay hidden unless the business opted in, or it is the reader's own business.

**Round 17 look.**
- Floor signs (icon plus name) float over each floor in the scene, placed each frame and hidden when off screen.
- Floor icons are shared by the scene signs and the gauge (`components/flow-map/silo/floor-icons.tsx`).
- The brand line is the gold logo mark plus "The Collective". There's no centre text.
- The third number is now "Links", the count of businesses with enough receipts to draw a line.

**A smaller hero you can fold.**
- The badge, a shorter headline, and the sign in / add receipt / counted total row stay visible.
- Ticket 161's three steps fold under a native "How it works" disclosure that needs no JavaScript. "How we count" links to the method page.

**Four cards gone from the map page.**
- The personal impact, owner, CSV and privacy cards are removed.
- The method page (`/flow-map/methodology`) now carries:
  - in section 5, a note that every business shows as a dot with no figure until it clears the rule, plus the receipt opt-out choice;
  - a new section 10, "Download the data", with both CSV links and the threshold interpolated.
- "Your personal impact" is already in Account, Receipts (ticket 164).

**Rename.** Reader-facing text says "The Collective", not "The Silo". Code names (`Silo*`) stay.

## Acceptance criteria

- Given no counted receipts, when anyone opens /flow-map, then every published business shows as a dot, there are no lines, and no dollar figure shows for any business.
- Given a business with at least `AGGREGATE_MIN_TRANSACTIONS` counted receipts, then it has a line, a total, and can appear in the ticker and the list.
- Given a phone at 375px, then the hero fits above the scene with the steps folded, and "How it works" opens and closes by keyboard and touch.
- The method page links back to /flow-map, interpolates the threshold, and offers both CSVs.
- No em dashes in new reader copy. Copy says "spent", never "circulated".

## Tests

- `tests/silo-layout.test.ts`: unlinked rows carry no totals; linked follows the threshold.
- `tests/flow-map-methodology.test.ts` and `tests/aggregate-privacy.test.ts`: point at the notice's new home.
- `pnpm typecheck`, `pnpm lint` (0 errors) and `pnpm test:unit` (4017 pass) are green.

## Open

- Counsel items R2, R3 and R5 from the receipt-read switch-on are still open. This ticket changes none of them.
