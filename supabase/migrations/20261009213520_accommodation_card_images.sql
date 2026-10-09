-- Independent presentation reference: no profile/gallery/banner rows or originals changed.
CREATE TABLE IF NOT EXISTS public.company_profile_card_images (
 profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id),
 asset_id uuid NOT NULL REFERENCES public.media_library_assets(id),
 bucket_id text NOT NULL CHECK (bucket_id IN ('company-media','project-media')),
 storage_path text NOT NULL,
 alt_text text NOT NULL DEFAULT '' CHECK (char_length(alt_text)<=500),
 focus_x numeric NOT NULL DEFAULT 50 CHECK (focus_x BETWEEN 0 AND 100 AND focus_x=round(focus_x,1)),
 focus_y numeric NOT NULL DEFAULT 50 CHECK (focus_y BETWEEN 0 AND 100 AND focus_y=round(focus_y,1)),
 zoom numeric NOT NULL DEFAULT 1 CHECK (zoom BETWEEN 1 AND 3 AND zoom=round(zoom,2)),
 CHECK ((bucket_id='company-media' AND storage_path LIKE 'profiles/' || profile_id::text || '/%'
   AND storage_path ~ '\.(jpg|png|webp)$') OR (bucket_id='project-media' AND storage_path LIKE '/reiseportal/%'))
);
CREATE INDEX IF NOT EXISTS company_profile_card_images_asset ON public.company_profile_card_images(asset_id);
ALTER TABLE public.company_profile_card_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_card_images FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_profile_card_images TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.company_profile_card_images TO authenticated;
CREATE POLICY card_images_public_read ON public.company_profile_card_images FOR SELECT TO anon,authenticated
 USING (EXISTS(SELECT 1 FROM public.company_profiles p WHERE p.id=profile_id AND p.status='approved'
  AND NOT EXISTS(SELECT 1 FROM public.company_profile_public_visibility v WHERE v.profile_id=p.id AND NOT v.is_listed)));
CREATE POLICY card_images_admin ON public.company_profile_card_images FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));

-- Invoker trigger validates/locks the existing catalog entry. No public definer RPC.
CREATE OR REPLACE FUNCTION private.guard_card_image_reference() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.media_library_assets;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())) THEN
  RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM public.media_library_assets WHERE id=NEW.asset_id FOR SHARE;
 IF a.id IS NULL OR a.profile_id IS DISTINCT FROM NEW.profile_id OR a.bucket_id NOT IN ('company-media','project-media')
  OR a.kind='video' OR a.archived_at IS NOT NULL OR a.deletion_requested_at IS NOT NULL OR a.deleted_at IS NOT NULL THEN
  RAISE EXCEPTION 'Unavailable provider image' USING ERRCODE='23514'; END IF;
 IF a.bucket_id='company-media' AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id=a.bucket_id AND name=a.storage_path) THEN
  RAISE EXCEPTION 'Missing image' USING ERRCODE='23514'; END IF;
 NEW.bucket_id:=a.bucket_id; NEW.storage_path:=a.storage_path; NEW.alt_text:=a.alt_text;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_card_image_reference() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_card_image_reference BEFORE INSERT OR UPDATE ON public.company_profile_card_images
 FOR EACH ROW EXECUTE FUNCTION private.guard_card_image_reference();

-- Read only the explicitly chosen image of a publicly listed approved profile.
CREATE POLICY company_card_image_public_read ON storage.objects FOR SELECT TO anon,authenticated
 USING (bucket_id='company-media' AND EXISTS(SELECT 1 FROM public.company_profile_card_images c
  WHERE c.bucket_id=objects.bucket_id AND c.storage_path=objects.name
  AND EXISTS(SELECT 1 FROM public.company_profiles p WHERE p.id=c.profile_id AND p.status='approved'
   AND NOT EXISTS(SELECT 1 FROM public.company_profile_public_visibility v WHERE v.profile_id=p.id AND NOT v.is_listed))));

-- Extend the existing usage/cleanup guard, keeping all previous reference sources.
CREATE OR REPLACE FUNCTION private.media_library_references(p_bucket text, p_path text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'profileId',profile_id,'id',id)),'[]'::jsonb) FROM (
 SELECT 'Unternehmensgalerie'::text label,i.profile_id,i.id FROM public.company_profile_images i WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Logo',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.logo_path=p_path
 UNION ALL SELECT 'Ansprechpartnerbild',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-media' AND p.contact_image_path=p_path
 UNION ALL SELECT 'Inhaltsblock',b.profile_id,i.id FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id WHERE p_bucket='company-media' AND i.storage_path=p_path
 UNION ALL SELECT 'Werbebanner',c.profile_id,c.id FROM public.company_ad_campaigns c WHERE p_bucket='ad-media' AND c.image_path=p_path
 UNION ALL SELECT 'Profilvideo',p.id,p.id FROM public.company_profiles p WHERE p_bucket='company-profile-videos' AND p.video_path=p_path
 UNION ALL SELECT CASE WHEN u.block_id IS NULL THEN 'Profilvideo (Mediathek)' ELSE 'Video-Inhaltsblock' END,u.profile_id,u.id FROM public.profile_video_uses u WHERE (p_bucket='company-profile-videos' AND u.storage_path=p_path) OR (p_bucket='external-video' AND u.external_url=p_path)
 UNION ALL SELECT 'Unterkunftskarte',c.profile_id,c.profile_id FROM public.company_profile_card_images c WHERE c.bucket_id=p_bucket AND c.storage_path=p_path
 ) refs;
$function$
;

NOTIFY pgrst, 'reload schema';
