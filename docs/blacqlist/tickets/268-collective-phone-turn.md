# Ticket 268: Turning The Collective on an iPhone

**Status:** Built on `fix/267-collective-core-nan` (with 267, PR #398), 2026-11-22. Not merged.

Founder (2026-11-22, after the 267 fix): "On iPhone, I can't seem to rotate the camera effectively."

## The Problem

In phone full-screen, a sideways swipe often did nothing, or moved the floors instead of turning.

Measured at 390×844 with touch input, before the fix:

- **Only 49% of the screen reached the map.**
  - The title, the figures and the "Latest" ticker took every touch along the top (about 170 px). That includes their plain text, not just the Demo / Live buttons.
  - The bottom sheet and the floor rail take the rest, which is expected.
- **A thumb's arcing start picked floors.**
  - The swipe chose its direction after 5 px.
  - A right thumb usually starts up and to the left before it flattens out. So the swipe often locked to "floors", rode a few pixels, and settled back on the same floor. Nothing seemed to happen.
- **The turn was slow and stopped dead.**
  - A full-width swipe turned 134°.
  - A flick coasted at most 17°.

## What Changed

- **Touches pass through the top** (`silo.css`). In full-screen, the title, figures and ticker let a finger through to the map. Only their buttons and links take a touch, so the Demo / Live switch still works.
- **A swipe waits for a clear direction** (`SiloScene.tsx`, `SWIPE` in `lib/spend/silo-layout.ts`):
  - It picks turning or floors after 12 px (`lockPx`), not 5.
  - Until 64 px (`settlePx`) it can still change its mind. When it does, it undoes what the other direction did and counts the whole move for the new one. A thumb that starts upward and then goes sideways now turns.
  - Past 64 px the direction is final, as before. Up and down still travels the floors and lands on one.
- **Turning is faster on a phone** (`swipeTurnRate`). A swipe across the screen turns the view half way round: 180° on an upright phone, up from 134°. It's never slower than a mouse drag, so sideways phones keep today's rate.
- **A flick coasts further.** The cap went from 1.2 to 2 (`SWIPE.spinMax`), still under the mouse's 3. A flick now coasts up to about 29°.
- **The hint says how to turn.** In full-screen it reads "Swipe sideways to turn, up or down for floors." It wraps on the narrowest phones instead of running off the edge.
- **Not changed:** mouse and trackpad, two-finger pinch and tilt, and the bottom sheet.

## Checks (local, 2026-11-22)

Playwright with touch input at 390×844, in full-screen:

| Swipe                                     | Before          | After                         |
| ----------------------------------------- | --------------- | ----------------------------- |
| Screen that reaches the map               | 49%             | 64% (59% at 360×740, 844×390) |
| 200 px sideways                           | 64°             | 86° (92° with coast)          |
| Over the title, figures or ticker         | nothing         | 86°                           |
| Wobbly start: 9 px up, then sideways      | floors, no turn | 85°                           |
| Thumb arc starting about 60° up           | floors, no turn | 96°                           |
| Quick 120 px flick                        | 33° (41° coast) | 44° (55° coast)               |
| Straight up 300 px                        | one floor       | one floor                     |
| Up 300 px, 15° drift / down with a wobble | —               | one floor each, no turn       |
| Demo / Live switch                        | taps            | still taps                    |
| Hint at 390, 360 and 844 wide             | ran off at 390  | fits                          |
| Console errors                            | —               | 0                             |

- **Local checks:** `tsc` clean, lint clean, vitest **5944 passed**.
- **New tests:**
  - in `tests/silo-layout.test.ts`: a half turn per phone screen, never slower than a mouse, and the lock and settle distances;
  - in `tests/flow-map-page.test.ts`: the top passes touches through, and an arcing swipe can change its mind.
- **Still needed:** a real iPhone check. Playwright sends clean touch events, while a real thumb is noisier.

## Later

- The bottom sheet covers the bottom third of a phone, which is where a thumb rests. In full-screen with nothing picked, it could shrink to the colour key. That changes the look, so it's a founder call.
- On iOS a swipe that starts at the very left edge is Safari's own Back, which closes full-screen. Websites can't turn this off.
