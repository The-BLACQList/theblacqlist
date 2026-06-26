insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-media',     'listing-media',     true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('verification-docs', 'verification-docs', false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('receipt-uploads',   'receipt-uploads',   false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
