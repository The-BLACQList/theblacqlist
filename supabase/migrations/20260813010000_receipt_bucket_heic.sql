-- Widen the receipt-uploads bucket to the formats the product already promises.
--
-- Two advertised-but-rejected drifts closed here:
--   1. components/spend/ReceiptSubmissionForm.tsx tells the user "JPEG, PNG,
--      HEIC" — HEIC was never in allowed_mime_types. iPhone photo-library
--      picks deliver image/heic, so the flagship capture path had a format
--      cliff with no explanation.
--   2. app/api/upload/[bucket]/route.ts:13 accepts application/pdf for this
--      bucket — the bucket did not. Emailed PDF receipts failed at storage.
--
-- Additive and idempotent. Written as insert..on conflict do update rather than
-- a bare update so it is self-healing on any environment where
-- 20260524000000_storage_buckets.sql has not been applied yet.
--
-- Rollback: re-run with allowed_mime_types set back to
--   array['image/jpeg','image/png','image/webp']
-- No data migration either way — this only changes what future uploads accept.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipt-uploads',
  'receipt-uploads',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
)
on conflict (id) do update
  set allowed_mime_types = excluded.allowed_mime_types,
      file_size_limit    = excluded.file_size_limit;
