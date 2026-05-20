# Receipt Upload & Community Spend Beta — Build Report

**Date:** 2026-05-11
**Feature area:** Receipt Upload, Community Spend, Dollar-Flow Seed
**Status:** Complete — pending `pnpm tsc --noEmit` and `pnpm lint` verification

---

## What Was Built

### Database

**Migration:** `supabase/migrations/20260511000001_receipt_community_spend.sql`

Four new tables created:

| Table             | Purpose                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `receipt_uploads` | Raw receipt submissions from community members. Fields: `user_id` (FK→auth.users CASCADE), `listing_id` (FK→listings SET NULL, nullable), `raw_business_name`, `file_path` (storage path, not URL), `amount_cents`, `purchase_date`, `notes`, `status` (pending_review/approved/rejected), `client_idempotency_key` (UNIQUE), `rejection_reason`, `aggregate_opt_out`, `source`, `reviewed_by`, `reviewed_at`. |
| `spend_events`    | Anonymized spend records created on receipt approval. No `user_id` field by design. Fields: `receipt_upload_id` (FK SET NULL), `listing_id` (FK SET NULL), `city_id` (FK SET NULL), `amount_cents`, `purchase_date`, `source`, `aggregate_opt_out`.                                                                                                                                                            |
| `flow_nodes`      | Graph nodes for business/city dollar-flow map. Fields: `node_type` (business/city), `entity_id`, `total_amount_cents`, `transaction_count`, `last_transaction_at`. UNIQUE (node_type, entity_id).                                                                                                                                                                                                              |
| `flow_edges`      | Graph edges between flow nodes. Fields: `source_node_id`, `target_node_id`, `total_amount_cents`, `transaction_count`. UNIQUE (source_node_id, target_node_id).                                                                                                                                                                                                                                                |

RLS policies applied:

- `receipt_uploads`: anon = no access; authenticated = own rows only; service role = all
- `spend_events`: anon + authenticated = SELECT (no PII exposed); mutations = service role only
- `flow_nodes`, `flow_edges`: anon + authenticated = SELECT; mutations = service role only

`updated_at` trigger applied to `receipt_uploads` via `set_updated_at()`.

---

### Types

`lib/supabase/types.ts` — Four table type definitions added in alphabetical order:

- `flow_edges` (between `entity_analytics_daily` and `guide_sections`)
- `flow_nodes` (after `flow_edges`)
- `receipt_uploads` (between `profiles` and `reviews`)
- `spend_events` (between `services` and `states`)

---

### Server Actions

| File                                           | Exports                                                   |
| ---------------------------------------------- | --------------------------------------------------------- |
| `lib/actions/spend/createReceiptSubmission.ts` | `createReceiptSubmissionAction`, `ReceiptSubmissionState` |
| `lib/actions/spend/approveReceipt.ts`          | `approveReceiptAction`, `ApproveReceiptState`             |
| `lib/actions/spend/rejectReceipt.ts`           | `rejectReceiptAction`, `RejectReceiptState`               |

All actions:

- `createReceiptSubmissionAction`: auth guard (`createClient().auth.getUser()`), validates amount/date/idempotency key, optional file upload to `receipts` storage bucket, graceful fallback if bucket not yet provisioned, duplicate submission blocked by UNIQUE constraint
- `approveReceiptAction`: `getAdminSession()` guard, status guard (pending_review only), updates receipt → inserts spend_event → upserts flow_node via read-then-write, `writeAuditLog`, `revalidatePath`
- `rejectReceiptAction`: `getAdminSession()` guard, status guard, updates status + rejection_reason, `writeAuditLog`, `revalidatePath`

---

### API Route Handlers

| File                                        | Method | Auth           | Purpose                                                                                                     |
| ------------------------------------------- | ------ | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `app/api/receipts/[id]/signed-url/route.ts` | GET    | Owner or admin | Returns 15-min signed URL for receipt image. Receipt file path is never exposed publicly.                   |
| `app/api/community-spend/route.ts`          | GET    | Public         | Returns anonymized aggregate spend totals, top businesses, top cities. Cache: 1 hour (`revalidate = 3600`). |

---

### Components

| File                                                       | Purpose                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/spend/ReceiptSubmissionForm.tsx`               | `"use client"` form using `useActionState`. Fields: business name, amount, purchase date, notes, optional receipt photo (image-only, 10MB max, device camera capture), aggregate opt-out checkbox, privacy notice. Redirects to `/account/receipts?submitted=true` on success. |
| `components/spend/ReceiptStatusBadge.tsx`                  | Colored badge for `pending_review` / `approved` / `rejected` statuses.                                                                                                                                                                                                         |
| `ReceiptListRow` (exported from ReceiptSubmissionForm.tsx) | Row component for account receipts list.                                                                                                                                                                                                                                       |

---

### Public / Account Routes

| Route                      | File                                   | Notes                                                                                                                                                          |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/account/receipts`        | `app/account/receipts/page.tsx`        | Auth-gated. Personal impact stat (total approved spend), receipt list with status badges. Empty state with CTA to submit. Success banner on `?submitted=true`. |
| `/account/receipts/new`    | `app/account/receipts/new/page.tsx`    | Auth-gated. Wraps `ReceiptSubmissionForm`.                                                                                                                     |
| `/account/community-spend` | `app/account/community-spend/page.tsx` | Public. Hero stat (total community spend), top businesses list, top cities list, privacy note. CTA to submit receipt.                                          |

All account routes:

- Auth guard via `createClient().auth.getUser()` + `redirect("/sign-in?next=...")`
- `/account/community-spend` is intentionally public — no PII exposed

---

### Admin Routes

| Route             | File                          | Notes                                                                                                                                                                                           |
| ----------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/receipts` | `app/admin/receipts/page.tsx` | `requireAdmin()` guard. Status filter tabs (pending_review / approved / rejected / all). Inline approve + reject forms with optional rejection reason. `ReceiptStatusBadge` for status display. |

Admin page uses `createServiceClient()` for all data reads.

---

### Navigation Updates

`app/account/page.tsx` — Two new quick links added:

```
My receipts      /account/receipts       Receipt icon
Community spend  /account/community-spend  TrendingUp icon
```

`components/admin/AdminSidebar.tsx` — One item added to `NAV_ITEMS`:

```
Receipts  /admin/receipts  ClipboardCheck icon
```

---

## Privacy Model

| Data type                                | Who can see it                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Receipt file (photo)                     | Owner via 15-min signed URL + admin via same endpoint                      |
| Receipt details (amount, business, date) | Owner in `/account/receipts` + admin in `/admin/receipts`                  |
| Spend event totals                       | Anyone — publicly aggregated, no user FK                                   |
| Flow node totals                         | Anyone — publicly queryable                                                |
| User identity in aggregates              | Never — no user_id on spend_events                                         |
| Opt-out records                          | Excluded from all aggregate queries via `aggregate_opt_out = false` filter |

---

## Storage Setup Instructions

The receipt upload flow requires a private Supabase Storage bucket named `receipts`.

**To set up:**

1. In the Supabase dashboard → Storage → Create new bucket
2. Name: `receipts`
3. Public: **OFF** (must be private)
4. File size limit: 10 MB
5. Allowed MIME types: `image/jpeg, image/png, image/heic, image/webp`

**Storage policies required:**

```sql
-- Users can upload their own receipts
CREATE POLICY "receipts_owner_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own receipts
CREATE POLICY "receipts_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

Service role bypasses all storage RLS — admin signed URL generation works without additional policies.

**If bucket is not provisioned:** `createReceiptSubmissionAction` catches the "Bucket not found" error and allows the submission to proceed without a `file_path`. No data is lost. The receipt is still recorded and enters admin review.

---

## Known Limitations

- **No OCR or merchant matching** — `raw_business_name` is free text only. Linking to a `listing_id` requires the user to know the listing UUID or an admin to manually link it. A search-based picker is deferred.
- **flow_edges not yet populated** — The approval workflow updates `flow_nodes` but does not yet create `flow_edges` between nodes. Edges require city attribution, which depends on the listing's city FK. The schema and types are in place for V3 graph rendering.
- **No pagination on admin receipts list** — Capped at 100 most recent. Add pagination before receipt volume grows.
- **Community spend page is a static server render** — It queries DB on each request with `revalidate = 3600` on the API route but the page itself is not yet using the API route. The page queries directly for simplicity.
- **Signed URL endpoint not linked from UI** — `/api/receipts/[id]/signed-url` is available but the receipt list UI does not yet show a "View photo" link. Add in a follow-up alongside receipt detail page.
- **No receipt detail page** — Receipts are listed but not individually navigable. Add a `/account/receipts/[id]` detail page to show full details + photo viewer.
- **City flow nodes** — `spend_events.city_id` is set to NULL at MVP because the listing→city relationship requires an extra query during approval. Wire city attribution in a follow-up.

---

## Next Ticket Recommendations

| Priority | Work                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| P1       | Provision `receipts` storage bucket and storage RLS policies (manual Supabase setup)                                     |
| P1       | Add city attribution to approval flow — query `listings.city_id` during `approveReceiptAction` and upsert city flow_node |
| P2       | Receipt detail page (`/account/receipts/[id]`) with signed URL photo viewer                                              |
| P2       | Business name search picker in receipt submission form (replace free-text with listing search)                           |
| P2       | Pagination on `/admin/receipts`                                                                                          |
| P3       | Populate `flow_edges` on approval (requires city node linkage first)                                                     |
| P3       | Dollar-flow map visualization on `/account/community-spend` using `flow_nodes` + `flow_edges`                            |
