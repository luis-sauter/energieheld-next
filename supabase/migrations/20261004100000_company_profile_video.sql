-- Optional profile video. Existing image buckets, grants, policies and rows stay
-- untouched: their 5 MiB image-only limit is not broadened for videos.
ALTER TABLE public.company_profiles ADD COLUMN video_path text;
ALTER TABLE public.company_profiles ADD CONSTRAINT company_video_path_format CHECK (
  video_path IS NULL OR video_path ~ ('^profiles/' || id::text || '/video/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$')
);
GRANT SELECT (video_path) ON public.company_profiles TO anon, authenticated;
GRANT UPDATE (video_path) ON public.company_profiles TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-profile-videos', 'company-profile-videos', false, 26214400, ARRAY['video/mp4','video/webm']);

-- Narrow boolean guard: no rows/paths are returned. SECURITY DEFINER is needed
-- so referenced-file cleanup cannot be fooled by the caller's row visibility.
CREATE FUNCTION public.can_access_profile_video(p_name text, p_write boolean, p_remove boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.company_profiles; allowed boolean;
BEGIN
  IF p_name IS NULL OR p_name !~ '^profiles/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/video/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$' THEN RETURN false; END IF;
  SELECT * INTO p FROM public.company_profiles WHERE id::text = split_part(p_name, '/', 2);
  IF NOT FOUND THEN RETURN false; END IF;
  allowed := auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.portal_admins WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.companies WHERE id = p.company_id AND owner_user_id = auth.uid())
  );
  IF p_write THEN
    RETURN allowed AND (NOT p_remove OR NOT EXISTS (SELECT 1 FROM public.company_profiles WHERE video_path = p_name));
  END IF;
  RETURN allowed OR (p.status = 'approved' AND p.video_path = p_name);
END;
$$;
REVOKE ALL ON FUNCTION public.can_access_profile_video(text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_profile_video(text,boolean,boolean) TO anon, authenticated;

CREATE POLICY profile_video_read ON storage.objects FOR SELECT TO anon, authenticated USING (
  bucket_id = 'company-profile-videos' AND public.can_access_profile_video(name, false)
);
CREATE POLICY profile_video_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'company-profile-videos' AND public.can_access_profile_video(name, true)
);
CREATE POLICY profile_video_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'company-profile-videos' AND public.can_access_profile_video(name, true, true)
);
-- No UPDATE/upsert policy: a referenced video cannot be overwritten in place.

CREATE FUNCTION private.guard_company_profile_video() RETURNS trigger
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
      AND CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,9}$' THEN (o.metadata->>'size')::bigint BETWEEN 1 AND 26214400 ELSE false END)
  ) THEN RAISE EXCEPTION 'invalid profile video'; END IF;
  -- Ordinary profile media, like the current logo/gallery: do not change
  -- status/approved_at. Existing publication guards still govern those fields.
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_company_profile_video() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_company_profile_video BEFORE INSERT OR UPDATE OF video_path ON public.company_profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_company_profile_video();
