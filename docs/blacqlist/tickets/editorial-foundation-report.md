# Editorial Foundation Report

**Date:** 2026-05-11
**Feature area:** Collections, Guides, BLACQLight (editorial system)
**Status:** Complete — 0 TypeScript errors, 0 lint errors

---

## What Was Built

### Database

**Migration:** `supabase/migrations/20260511000000_editorial_foundation.sql`

Three new tables created:

| Table                | Purpose                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `editorial_articles` | BLACQLight stories and spotlight pieces. Fields: `title`, `slug`, `subtitle`, `body`, `author_name`, `tags` (text[]), `status`, `published_at`, `meta_description`, `cover_image_path`, `created_by`. |
| `guides`             | City guides. Fields: `title`, `slug`, `subtitle`, `description`, `city`, `status`, `published_at`, `meta_description`, `cover_image_path`, `created_by`.                                              |
| `guide_sections`     | Sections within a guide. Fields: `guide_id` (FK), `heading`, `body`, `display_order`.                                                                                                                 |

RLS policies applied:

- Anon + authenticated: read `status = 'published'` only
- `guide_sections`: readable only when parent guide is published
- Service role bypasses RLS for all admin writes

`updated_at` trigger applied to all three tables via `set_updated_at()`.

---

### Types

`lib/supabase/types.ts` — Three table type definitions added in alphabetical order: `editorial_articles`, `guide_sections`, `guides`.

---

### Server Actions

| File                                   | Exports                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/actions/editorial/collections.ts` | `createCollectionAction`, `updateCollectionAction`, `deleteCollectionAction`, `addCollectionItemAction`, `removeCollectionItemAction`             |
| `lib/actions/editorial/articles.ts`    | `createArticleAction`, `updateArticleAction`, `deleteArticleAction`                                                                               |
| `lib/actions/editorial/guides.ts`      | `createGuideAction`, `updateGuideAction`, `deleteGuideAction`, `createGuideSectionAction`, `updateGuideSectionAction`, `deleteGuideSectionAction` |

All actions:

- `await requireAdmin()` guard
- `createServiceClient()` (sync) for all DB writes
- `revalidatePath()` on public and admin paths after mutations
- Manual validation — no zod, matching existing `submitListing.ts` pattern
- Publish/draft lifecycle: `action` field in formData (`"save"` / `"publish"` / `"unpublish"`)

---

### Components

| File                                                | Purpose                                                                                                                                         |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/editorial/CollectionCard.tsx`           | Card linking to `/collections/[slug]`. Shows icon, count, title, description.                                                                   |
| `components/editorial/GuideCard.tsx`                | Card linking to `/guides/[slug]`. Shows BookOpen icon, section count, title, subtitle, city.                                                    |
| `components/editorial/BlogPostCard.tsx`             | Card linking to `/blacqlight/[slug]`. Shows tags, title, subtitle, author, date.                                                                |
| `components/editorial/EditorialRichTextDisplay.tsx` | Plain-text body parser. `##` → h2, `###` → h3, `>` → blockquote, double newline → paragraph, single newline → `<br>`.                           |
| `components/editorial/AdminEditorialForm.tsx`       | Three form components: `CollectionAdminForm`, `ArticleAdminForm`, `GuideAdminForm`. All use `useActionState` + `useEffect` redirect on success. |

---

### Public Routes

| Route                 | File                                       | Notes                                                                                                         |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/collections`        | `app/(public)/collections/page.tsx`        | Grid of active collections with listing counts. Empty state.                                                  |
| `/collections/[slug]` | `app/(public)/collections/[slug]/page.tsx` | Collection detail. Listing row list with entity type, city, tagline. 404 if inactive/not found.               |
| `/guides`             | `app/(public)/guides/page.tsx`             | Grid of published guides with section counts. Empty state.                                                    |
| `/guides/[slug]`      | `app/(public)/guides/[slug]/page.tsx`      | Guide detail. Description + sections rendered with `EditorialRichTextDisplay`. 404 if unpublished.            |
| `/blacqlight`         | `app/(public)/blacqlight/page.tsx`         | Grid of published articles via `BlogPostCard`. Empty state.                                                   |
| `/blacqlight/[slug]`  | `app/(public)/blacqlight/[slug]/page.tsx`  | Article detail. Tags, title, subtitle, author, date, body via `EditorialRichTextDisplay`. 404 if unpublished. |

All detail pages:

- `generateMetadata` for SSR title/description (SEO)
- 404 via `notFound()` for missing or unpublished content
- `createClient()` (session-aware, respects RLS) for all public queries

---

### Admin Routes

| Route                          | File                                       | Notes                                                                                  |
| ------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `/admin/collections`           | `app/admin/collections/page.tsx`           | Table of all collections, active status, listing count. Link to edit.                  |
| `/admin/collections/new`       | `app/admin/collections/new/page.tsx`       | `CollectionAdminForm` with `createCollectionAction`. Redirects to list on save.        |
| `/admin/collections/[id]/edit` | `app/admin/collections/[id]/edit/page.tsx` | `CollectionAdminForm` + listing manager (add by UUID, remove by item ID).              |
| `/admin/guides`                | `app/admin/guides/page.tsx`                | Table of all guides, city, status, published date.                                     |
| `/admin/guides/new`            | `app/admin/guides/new/page.tsx`            | `GuideAdminForm` with `createGuideAction`.                                             |
| `/admin/guides/[id]/edit`      | `app/admin/guides/[id]/edit/page.tsx`      | `GuideAdminForm` + section manager (add, delete sections inline).                      |
| `/admin/blacqlight`            | `app/admin/blacqlight/page.tsx`            | Table of all articles, author, status, published date.                                 |
| `/admin/blacqlight/new`        | `app/admin/blacqlight/new/page.tsx`        | `ArticleAdminForm` with `createArticleAction`.                                         |
| `/admin/blacqlight/[id]/edit`  | `app/admin/blacqlight/[id]/edit/page.tsx`  | `ArticleAdminForm` with `updateArticleAction`. Live link shown for published articles. |

All admin routes:

- `requireAdmin()` guard (layout also guards at the segment level)
- `createServiceClient()` (sync) for admin data reads

---

### Admin Sidebar Update

`components/admin/AdminSidebar.tsx` — Three items added to `NAV_ITEMS`:

```
Collections  /admin/collections  Layers icon
Guides       /admin/guides       BookOpen icon
BLACQLight   /admin/blacqlight   Lightbulb icon
```

---

## Content Model

```
Editorial body format (plain text + lightweight syntax):
  ## Heading    → <h2>
  ### Heading   → <h3>
  > Quote       → <blockquote> with amber-gold left border
  \n\n          → new paragraph
  \n            → <br> within paragraph
```

No rich text editor installed. Body is stored as plain text and rendered by `EditorialRichTextDisplay`.

---

## SEO Notes

- All public routes export `generateMetadata` returning dynamic `title` and `description`
- Detail pages use `meta_description` field if present; fall back to `subtitle` or generic description
- All detail pages return 404 for unpublished/inactive content (no leaked draft URLs)
- No JSON-LD structured data added at this stage — defer to SEO audit ticket (ticket 090)

---

## Known Limitations

- **No cover image support yet** — `cover_image_path` columns exist in DB and types but no upload UI or display logic is wired. Add in a follow-up alongside the media upload work (ticket 030).
- **No pagination on admin list pages** — Collections, guides, and articles lists are unbounded. Safe at editorial scale but should be paginated before content volume grows.
- **Guide section edit** — Only add/delete is supported in the admin. Inline editing of section content requires a client-side form; deferred to avoid adding complexity to Server Component pages.
- **Article tags filter on public `/blacqlight`** — Tags are stored and displayed on cards but there is no tag-based filter on the index page. Add as a follow-up.
- **Collection listing add by UUID** — The admin UI for adding listings to collections requires pasting a UUID. A name-search picker would improve UX; deferred.

---

## Next Ticket Recommendations

| Priority | Work                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| P1       | Wire `cover_image_path` upload to editorial admin forms (extends ticket 030 media upload) |
| P1       | Add JSON-LD structured data to editorial detail pages (extends ticket 023 pattern)        |
| P2       | Pagination on admin editorial list pages                                                  |
| P2       | Guide section inline edit (requires `"use client"` section editor component)              |
| P2       | Tag filter on `/blacqlight` index page                                                    |
| P3       | Collection listing search picker in admin (replace UUID paste)                            |
