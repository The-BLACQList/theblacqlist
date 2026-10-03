# Ticket 117 — The BLACQLight article page

**Phase:** V1.5 · **Priority:** P2 · **Status:** Ready to build, ships in the same PR as 116
**Depends on:** 116 (shared helpers)
**Spec:** [page-workshop-2026-10-spec.md §3](../design/page-workshop-2026-10-spec.md#article-page-changes)

---

## Acceptance criteria

- The header shows the back link, kind, h1, subtitle as the dek, and "By {author} · {date} · {n} min read".
- The cover renders as a `<figure>` when `cover_image_path` is set. There is no caption until ticket 118.
- `EditorialRichTextDisplay` renders markdown links `[text](href)`:
  - Internal paths become `next/link`.
  - External `https:` links open normally, with `rel="noopener noreferrer"`.
  - Any other scheme (`javascript:`, `data:`) renders as plain text.
  - Unit tests cover all three cases.
- "Featured in this story" shows up to 3 published listings linked from the body: name, category · city, tier · ownership label, and "Visit their page". It is hidden when there are none.
- More stories and Explore businesses stay. The body measure stays about 65ch.
- An unknown or unpublished slug still returns `notFound()`.

## Content note

Adding links to the live stories is an edit to published content. That is **GATE-PUBLISH**, and is separate from this PR.

## QA notes

- Test a story with no cover, no links, and no blockquote.
- Test a story with a link to an unpublished listing; it must not show.
- Test a malicious link scheme.
