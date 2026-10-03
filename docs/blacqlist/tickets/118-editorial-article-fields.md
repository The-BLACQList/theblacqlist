# Ticket 118 — Editorial fields: photo credit and linked businesses

**Phase:** Later · **Priority:** P3 · **Status:** Needs decision (spec Q3, option B)
**Depends on:** 116, 117 shipped
**Gates:** GATE-DATA (migration on staging, then production)

---

## Why

Option A links businesses through the body text. That works, but it's easy to break, and it gives no place to store photo credits. If a photo license requires a visible credit, or there are about 10 stories, move to real fields.

## Proposed schema (additive, reversible)

- `editorial_articles.cover_credit text null`
- `editorial_articles.cover_caption text null`
- `editorial_article_listings (article_id uuid fk → editorial_articles on delete cascade, listing_id uuid fk → listings on delete cascade, position int, primary key (article_id, listing_id))`
  - RLS: public read joined to published articles; admin write.

The down plan drops the two columns and the table. No existing data changes.

## Acceptance criteria

- The admin form gets credit and caption fields and a listing picker (published listings only).
- Ticket 117's featured card and ticket 116's directory strip read from the join table first, then fall back to body links.
- The figure caption shows "{caption}. Photo: {credit}" when set.
- `lib/supabase/types.ts` is regenerated from the schema, not hand-edited.
- The migration is applied to staging and verified before the production GATE-DATA.
