# 195: Highlights and process steps — "Why choose us", "How it works"

**Status:** Planned — from the 184 plan, founder 2026-11-13. Not started. Own branch and draft PR off `origin/main` once 184 has merged; **no merge before Wed 18 Nov 2026** (launch merge freeze).
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
