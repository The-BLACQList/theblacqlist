# Ticket 167: Silo, layout B Instrument, on /flow-map

**Phase:** V1.5 · **Priority:** P1 · **Status:** Blocked on open question O4 (adding Three.js and React Three Fiber)
**Depends on:** none to start. 166 links into it.
**Gates:**
- GATE-DEPLOY.
- New dependencies need the founder's OK (O4).
- No migration.
- Before building, read `.claude/reference/3d/` (experiences, performance, accessibility, qa).

**Decision record:**
- Founder, 2026-10-21: Silo picked.
- Founder, 2026-10-31: Screen 6 **B, Instrument**, plus Q7 to Q14 below.

**Spec:** `docs/blacqlist/flow-map/visual-workshop-2026-10.md` §20 (round 17). This is on the unmerged branch `docs/ai-layer-vision`, commit `e70089d`, and goes in with this ticket's PR. Round 17 artifact: https://claude.ai/artifact/HnNKpmGYQ3MKHFyaeav8fd

---

## Why

The founder turned The Collective off until the new design is live. Silo is that design.

## Scope

In:

- **Layout B, Instrument.** One left column holds the totals, the floor gauge, the color key, the selected business and the ticker, and the scene gets the rest. Between 1024 and 1279px the totals fold into one row (borrowed from C). Layouts A and C aren't built: Q7 retires A.
- **Phones (Q8):** the shared phone layout. Numbers on top, then the scene, then panels.
- **Honest to the data.** Rules from the Collective workshop:
  - Copy says "spent", never "circulated".
  - The first floor shows its total.
  - Lower floors are dimmed with "Not tracked yet" (Q14), and floor bars keep their words (Q9).
  - Shoppers show only as one group.
  - Business names show only for opted-in businesses.
  - `AGGREGATE_MIN_TRANSACTIONS` still applies.
- **Dots** are colored by category when the map opens (Q10), with gold kept for you. Level is one tap away.
- **Pulse (Q11):** one gold pulse per link every 1 to 2 minutes. None when reduced motion is on, plus a visible "Pause motion" button that stops all ambient motion.
- **Crowded neighborhoods (Q12):** close dots spread apart a little. Names show on hover, focus or tap, not all at once.
- **Finding yourself (Q13):** signed-in members with a counted receipt see a gold ring and a "You" tag on their business, which only they see. Find me focuses it. `?you=1` opens focused.
- **Loading and fallback:**
  - The page renders its HTML (161's steps, the totals and the table) first.
  - The 3D scene lazy-loads after that.
  - Without WebGL, or on a low-power device, it falls back to the table.
- **Accessibility:** round 17's six a11y fixes:
  - the More sheet traps focus;
  - letter shortcuts can be switched off;
  - the key map is closed by default;
  - gauge floors read their amounts aloud;
  - screen readers hear one status line;
  - focus stays put when the card redraws.
- **Retire the old pieces** from the page: `FlowMapNetwork`, `FlowMapFilters` and `FlowSummaryCards`. `FlowNodeTable` stays as the fallback and the "Explore as a list" view.

Out:

- Tracking money past the first stop (that needs data we don't have).
- The dollar tour, unless it can say "spent" honestly.

## Acceptance criteria

- Given a desktop at 1440 and 1280, layout B shows with no overlap or sideways scroll. Given 1100, the totals sit in one row.
- Given 390px, the shared phone layout shows, and tap targets are at least 44px.
- Given reduced motion, nothing pulses or drifts. Given "Pause motion", ambient motion stops until resumed.
- Given no WebGL, the table shows with the totals.
- Given a signed-in member with a counted receipt, their gold ring and You tag show, and another member doesn't see them.
- Given a business that hasn't opted in, its name never shows.
- The scene chunk loads only on `/flow-map`. Report the gzipped size in the PR. Page LCP doesn't regress against main.

## Failure states

| Failure | Result | Recovery |
|---|---|---|
| WebGL context lost | Table view with a "Try the map again" button | Reload the scene |
| Data read fails | "We couldn't load The Collective." | Try again |
| Scene chunk fails to load | Table view | Refresh |

## Tests

- Unit tests for the layout data (floors, "Not tracked yet", opt-in names, the min-transactions floor, the spread function).
- Playwright at 1440, 1280, 1100 and 390, plus reduced motion and no-WebGL.
- `3d-qa-release-check` before merge.
