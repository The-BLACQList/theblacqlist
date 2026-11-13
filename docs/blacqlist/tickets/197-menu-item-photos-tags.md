# 197: Menu-item photos and tags

**Status:** Stub — founder 2026-11-13. Not on the sample page; needs a decision before it is built.
**Follows:** 184, 186
**Area:** business pages (Offerings), the offerings editor

**Problem.** The offerings list is a price list. A restaurant wants a photo menu; a professional wants "popular" and "new" on services.

**Proposed shape.** `image_path` and `tags text[]` (vegan · gluten-free · popular · new, from a fixed list) on the services table (verify its name); the offerings card shows a thumbnail and chips. Uploads use the existing gallery role under `listings/{id}/offerings/`.

**Depends on.** 184 (section registry), the offerings editor. **Gate.** GATE-DATA for the migration.
