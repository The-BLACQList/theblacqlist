# Collective band workshop, November 2026

**For:** whoever touches the home Collective band next
**Last updated:** 2026-11-06
**Build:** ticket 182

The band predates The Collective. Once The Collective opened, the founder asked to rework how the band looks.

## The picks

All of these are final.

| Question               | Pick                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Direction              | A close-up of a section of the Silo: "dots and connects... Communicate the point without including every single dot." |
| Caption under the map  | None. "We don't need this."                                                                                           |
| Line under the heading | "Every receipt puts another dollar on the map. Together we can see where our money goes."                             |
| Gold                   | Site gold, `--color-gold` (`#C4A065`), not the Collective's `#E2A428`                                                 |
| Lines                  | Grow in steps with real purchases                                                                                     |
| Totals                 | All three: spent, purchases, businesses                                                                               |

Three earlier directions were set aside as "not so spot on": the Silo cut open, every business as a dot, and a ledger.

Words to avoid: "pool" (nothing is pooled) and "stacks up" (there's no shopper comparison).

## References

- **The live Silo** (`components/flow-map/silo/`). Borrow its floors, family colors, lines and pink gap squares. Leave out the 3D, the full dot count and the controls, apart from pause.
- **Current standard for a band like this:** one quiet data drawing beside real text, with the numbers kept as text so they can be read and selected. Motion can be stopped, and reduced motion gets a true still version.
- **Will this age?** A drawing of the product's own map should. It isn't a trend. The soft glow on lit dots is the only trend-like touch, and it's kept small.

## Honesty rules

The drawing is a sample of the shape, not a map of real businesses.

- Lines run only from the Shoppers floor to a business, never business to business, because only the first stop is tracked.
- Shoppers are never a dot.
- Gaps are dashed pink squares and never claim dollars leave.
- The line count never passes the real business count.

## Critique

One independent `design-critic` pass on the built band. Verdict: iterate, no fails.

| Area                                               | Result                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| Hierarchy, color, contrast, genericness, trend fit | Pass. "It could only be this product." Text contrast is 8.16:1 or better. |
| Type, spacing, motion, polish                      | Risk, with the fixes below                                                |

What changed after the critique:

- **Phone crop.** The art grew from 340px to 390px and the bottom fade shrank from 22% to 10%, so the Makers floor and the line ends show.
- **Phone tags.** The crop moved right so the tags no longer sit on a cluster.
- **Pause control.** It moved clear of the gap square on desktop.

These changes were checked against new screenshots, not a second critic pass.

What stayed, and why:

- **1024px crop.** The right side of the art is cut off between 1024 and 1279px. It still reads as a clean close-up, so it doesn't earn a third view.
- **Eyebrow repeats the heading.** It's from the approved board.
- **12px labels.** They match the rest of the site and measure 9:1 or better.
- **Pulse size, type scale, motion constants.** Polish, and nothing looks wrong at these sizes.

## Added beyond the board

The "Pause motion" control wasn't on the board. Motion running longer than five seconds needs a way to stop it (WCAG 2.2.2), and the Silo has the same control.
