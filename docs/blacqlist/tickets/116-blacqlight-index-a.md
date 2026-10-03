# Ticket 116 — The BLACQLight index A: "Cover story"

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready to build (Option A of spec Q3, approved 2026-10-03)
**Depends on:** none (no migration)
**Spec:** [page-workshop-2026-10-spec.md §3](../design/page-workshop-2026-10-spec.md#3-the-blacqlight-a-cover-story)

---

## Why

Today the index is a flat card grid. Cover story A leads with one story and turns readers toward the businesses in it.

## Acceptance criteria

- The header shows the eyebrow, the h1 "The BLACQLight", and the dek from the spec.
- The newest published article renders as the lead:
  - cover (or type-only when `cover_image_path` is null), kind, headline, subtitle, "By {author} · {n} min read", and "Read the story";
  - the card is one link.
- The read time is computed from the body: words ÷ 230, rounded up, minimum 1.
- The kind comes from the first tag that matches the `lib/editorial/kind.ts` map. With no match, no label shows.
- The pull-quote band renders only when the lead body has a `> ` blockquote.
- More stories shows the next 3 via `BlogPostCard` (new optional `kind` and `readMinutes` props). "All stories" shows only when there are more than 4.
- "From the directory" lists the published listings linked from the stories on the page (deduped, max 6), as "{name} · {category}". It is hidden when there are none.
- States:
  - 0 articles keeps "Stories coming soon";
  - a failed query shows "Couldn't load stories. Try again" (no longer looks like the empty state);
  - `loading.tsx` matches the new layout.
- The page works at 375px with no sideways scroll.

## Shared helpers (also used by 117)

- `lib/editorial/kind.ts` (tag → kind), `lib/editorial/readTime.ts`.
- `lib/editorial/linkedListings.ts`, which extracts internal listing paths `/{citySlug}/{entityType}/{listingSlug}` from a body and keeps published listings only.
- Unit tests for all three.

## Out of scope

Filters, search, pagination, admin form changes, and the join table (118).
