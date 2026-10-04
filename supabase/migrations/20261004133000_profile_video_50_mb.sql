-- Match the profile-video limit to the current Cloud global limit: 50 MB (50 MiB).
-- Private bucket, MIME types, RLS, grants and image limits remain unchanged.
UPDATE storage.buckets SET file_size_limit = 52428800
WHERE id = 'company-profile-videos';

CREATE OR REPLACE FUNCTION private.guard_company_profile_video() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.video_path IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.video_path IS NOT DISTINCT FROM OLD.video_path THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR NOT (
    EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.companies WHERE id = NEW.company_id AND owner_user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NEW.video_path IS NOT NULL AND (
    NEW.video_path !~ ('^profiles/' || NEW.id::text || '/video/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$') OR
    NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'company-profile-videos' AND o.name = NEW.video_path
      AND o.metadata->>'mimetype' = CASE WHEN NEW.video_path LIKE '%.mp4' THEN 'video/mp4' ELSE 'video/webm' END
      AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,9}$' THEN (o.metadata->>'size')::bigint BETWEEN 1 AND 52428800 ELSE false END)
  ) THEN RAISE EXCEPTION 'invalid profile video'; END IF;
  -- Ordinary profile media, like the current logo/gallery: do not change
  -- status/approved_at. Existing publication guards still govern those fields.
  RETURN NEW;
END;
$$;
