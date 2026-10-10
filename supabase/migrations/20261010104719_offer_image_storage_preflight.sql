-- Storage probes use contentLength before upload; completed objects use size.
-- Keep exact reserved path, expiry, MIME and byte-count checks; no UPDATE/DELETE.
BEGIN;
ALTER POLICY offer_request_image_insert ON storage.objects
WITH CHECK (
  bucket_id = 'ad-media'
  AND metadata->>'mimetype' IS NOT NULL
  AND COALESCE(metadata->>'size', metadata->>'contentLength') IS NOT NULL
  AND public.can_upload_offer_image(
    name,
    metadata->>'mimetype',
    COALESCE(metadata->>'size', metadata->>'contentLength')::bigint
  )
);
COMMIT;
