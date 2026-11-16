# 195: Highlights and process steps — "Why choose us", "How it works"

**Status:** In PR — stacked on 194 (#344). Migration `20261126000000_listing_highlights.sql` not applied anywhere yet: staging needs the founder's OK, production is GATE-DATA. Until it is applied the page loader shows no highlights block (the read is fail-soft) and Dashboard → Highlights says it couldn't load. What shipped: `listing_highlights` (kind highlight|step, icon a short kebab-case name or null, title 1–60, text 1–160 or null, RLS as `listing_faqs`), a new gated feature `highlights` at Starter with `TIER_LIMITS.highlights` Free 0 / Starter 4 / Growth 6 / Premium 6, and Dashboard → Highlights: a Style picker (Why Choose Us bullets or How It Works steps), then add, edit, Move Up/Down and remove. The server writes only icon names on the `HIGHLIGHT_ICONS` allow-list (the picker offers only those); a new item takes the page's kind, and switching style moves every item, so a page holds one kind. The page shows the first ones the plan allows in the owner's order; nothing is deleted when a page moves down a plan (ticket 105). Business pages only, not jobs or events. **One change from the proposed shape:** the editor is its own dashboard page (`/dashboard/pages/[id]/highlights`, as the section registry already pointed), not a panel in `PageFinishView`; 188 (click-to-fill) can link to it.
**Follows:** 184 (`EntityHighlightsSection`, `components/entity-page/highlightIcons.ts`)
**Area:** business pages, the owner editor (`PageFinishView#highlights`)
**Gates:** GATE-DATA for the migration.

## Why

The standard block on a small business's own site: three or four icon bullets for a shop, numbered steps for a consultancy or a commission.

## Proposed shape

- `listing_highlights(id, listing_id fk cascade, kind highlight|step, icon ≤40, title ≤60, text ≤160, sort_order, created_at, updated_at)`; RLS as `listing_faqs`; `set_updated_at`.
- Limits: Free 0 / Starter 4 / Growth+ 6 (decided here; the registry entry is free today). `icon` must be a key of `HIGHLIGHT_ICONS`; unknown names already fall back to Sparkles on render, and the editor offers only the allow-list.
- One kind per listing in the editor (bullets or steps), as the section renders either an icon grid or numbered steps.

## Checks

- Migration and limit tests; the icon picker writes only allow-listed names.
