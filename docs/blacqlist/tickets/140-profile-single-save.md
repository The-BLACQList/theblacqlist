# Ticket 140: One save for the whole page, a leave pop-up, and At a Glance at the top

**Phase:** V1.5 · **Priority:** P1 · **Status:** In progress
**Depends on:** 129 (shared finish view on every owner edit), 138 (writing help in Edit content)
**Gates:** none. No migration, no new dependencies.
**Decision record:** the founder asked for three changes on 2026-10-16 and then answered three questions:

1. **One button, live on save.** The page gets one Save button. On a live page it says **Publish changes**, and changes go public when it's tapped, just as they do today. Nothing new is stored, so there's no draft table.
2. **List items stay instant.** Only the typed fields join the one Save. Photos, services, links and FAQs still save the moment they're added or removed.
3. **At a Glance right under the header, on every page.** On the public page, At a Glance (hours, contact, socials) sits directly under the hero and quick facts on all three templates. The editor follows the same order.

---

## Why

Today the editor has a Save button on every card, which is about nine buttons. Owners edit three cards, save one, and lose the other two. The leave warning is the browser's plain "OK / Cancel" box, which doesn't offer to save. On the Creative and Professional templates, hours and contact sit near the bottom, below reviews.

## Scope

In:

- **Save bar.** A sticky bar at the bottom of the editor.
  - It says "Save changes" on a draft or under-review page and "Publish changes" on a live page.
  - It shows how many cards have changes ("2 cards changed").
  - It saves every changed card in order and shows one result. If a card fails, its red note stays on the card, and the bar names it and moves focus there.
- **Cards that join the bar:** Basics, About, Main button, Contact, Hours, Details, Social links, Video link, and How you show up on Google. Their own Save buttons and "Saved." notes go away in the editor.
  - Event and job editors keep their per-card buttons, since they aren't business profiles.
- **Only changed cards are saved.** A card counts as changed when its form values differ from when it was last saved. Untouched cards aren't sent, so an empty Main button can't block a save.
- **Enter in a field** runs the same save as the bar.
- **Leave pop-up.** It replaces the browser's OK / Cancel box for in-app links, with three choices:
  - **Publish changes** (or **Save changes** on a page that isn't live): saves, then goes where the owner was headed. If the save fails, the owner stays on the page.
  - **Leave without saving.**
  - **Keep editing.**
  - Reload and closing the tab still use the browser's own box, because browsers don't let a page change it.
- **Send for review** saves every changed card first, then sends the page.
- **Editor order:** Contact and Hours move up to right after About, to match the public page.
- **Public page:** on the Creative and Professional templates, At a Glance moves to right after the quick-facts rail, and the Visit tab moves to second. Storefront already works this way. At a Glance now always shows, as it does on Storefront, so socials aren't hidden when a page has no address or hours.

Out:

- Saved-but-unpublished drafts of a live page (founder chose "live on save").
- Batching list items (photos, services, links, FAQs) into the bar.

## Acceptance criteria

- Given a live page, when the owner edits the tagline and hours and taps Publish changes, then both save, the bar confirms once, and the public page shows both.
- Given a card with an error (for example, a website without https), when the owner taps Save, then the other cards still save, the failing card shows its red note, and focus moves to it.
- Given unsaved edits, when the owner clicks a dashboard link, then the pop-up opens. Keep editing stays put, Leave without saving navigates, and Publish changes saves and then navigates.
- Given no edits, when the owner clicks a link, then there's no pop-up.
- Given a Creative or Professional page, then At a Glance renders right after the quick facts, and the Visit tab is second.
- The bar and the pop-up work by keyboard alone. The pop-up traps focus and returns it when closed.

## QA notes

- Update e2e TA-11 and TA-12: they click each card's own Save button, which is gone in the editor.
- Check at 390 and 1440. The bar must not cover the last card or the Send for review button.
- Previews read staging data.
