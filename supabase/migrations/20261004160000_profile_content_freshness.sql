-- One editorial review subject per profile, independent of advertising/quality reviews.
CREATE TABLE public.profile_content_freshness (
  profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  content_revision bigint NOT NULL DEFAULT 1 CHECK (content_revision > 0),
  content_updated_at timestamptz,
  content_updated_by uuid,
  content_update_source text CHECK (content_update_source IN ('admin','provider','import','system')),
  reviewed_revision bigint,
  reviewed_at timestamptz,
  reviewed_by uuid,
  CHECK (reviewed_revision IS NULL OR reviewed_revision BETWEEN 1 AND content_revision),
  CHECK ((reviewed_at IS NULL AND reviewed_revision IS NULL AND reviewed_by IS NULL)
    OR (reviewed_at IS NOT NULL AND reviewed_revision IS NOT NULL AND reviewed_by IS NOT NULL))
);
ALTER TABLE public.profile_content_freshness ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_content_freshness FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_content_freshness TO authenticated;
CREATE POLICY profile_freshness_admin_read ON public.profile_content_freshness
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()
  ));
-- No historical date is implied by the neutral initial revision.
INSERT INTO public.profile_content_freshness(profile_id) SELECT id FROM public.company_profiles;

CREATE FUNCTION private.track_profile_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  previous jsonb := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  current_row jsonb := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  keys text[]; before_content jsonb; after_content jsonb;
  target uuid; former_target uuid; actor uuid := auth.uid(); source text;
  heading text; empty_slot jsonb;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'company_profiles' THEN
      keys := ARRAY['display_name','tagline','description','business_areas','phone','public_email','website',
        'street','postal_code','city','region','country','logo_path','logo_url','video_path'];
      target := COALESCE(current_row->>'id',previous->>'id')::uuid;
      IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    WHEN 'company_profile_categories' THEN keys:=ARRAY['category_id'];
    WHEN 'company_profile_travel_terms' THEN keys:=ARRAY['term_key'];
    WHEN 'company_profile_images' THEN keys:=ARRAY['storage_path','alt_text'];
    WHEN 'profile_content_blocks' THEN keys:=ARRAY['type','slot'];
    WHEN 'profile_content_block_images' THEN keys:=ARRAY['storage_path','alt_text','caption'];
    ELSE RAISE EXCEPTION 'unsupported review subject';
  END CASE;
  IF TG_TABLE_NAME='profile_content_block_images' THEN
    SELECT profile_id INTO target FROM public.profile_content_blocks
      WHERE id=COALESCE(current_row->>'block_id',previous->>'block_id')::uuid;
    SELECT profile_id INTO former_target FROM public.profile_content_blocks
      WHERE id=(previous->>'block_id')::uuid;
    -- Cascade deletion of the parent block already counts as content removal.
  ELSIF TG_TABLE_NAME<>'company_profiles' THEN
    target:=COALESCE(current_row->>'profile_id',previous->>'profile_id')::uuid;
    former_target:=(previous->>'profile_id')::uuid;
  END IF;
  SELECT jsonb_object_agg(k, previous->k),jsonb_object_agg(k,current_row->k)
    INTO before_content,after_content FROM unnest(keys) k;
  IF TG_TABLE_NAME='profile_content_blocks' THEN
    -- Pairing existing images, alignment and layout are presentation, not new content.
    before_content:=before_content || jsonb_build_object('content',
      jsonb_strip_nulls(jsonb_build_object('text',previous->'content'->'text',
        'hidden',NULLIF(previous->'content'->'hidden','false'::jsonb),
        'heading_hidden',NULLIF(previous->'content'->'heading_hidden','false'::jsonb),
        'hidden_blocks',NULLIF(previous->'content'->'hidden_blocks','[]'::jsonb),
        'deleted_sections',NULLIF(previous->'content'->'deleted_sections','[]'::jsonb))));
    after_content:=after_content || jsonb_build_object('content',
      jsonb_strip_nulls(jsonb_build_object('text',current_row->'content'->'text',
        'hidden',NULLIF(current_row->'content'->'hidden','false'::jsonb),
        'heading_hidden',NULLIF(current_row->'content'->'heading_hidden','false'::jsonb),
        'hidden_blocks',NULLIF(current_row->'content'->'hidden_blocks','[]'::jsonb),
        'deleted_sections',NULLIF(current_row->'content'->'deleted_sections','[]'::jsonb))));
    -- ensureSection persists an already visible default heading on first layout edit.
    -- Creating/removing that backing row alone does not change public content.
    IF COALESCE(current_row->>'slot',previous->>'slot') IS NOT NULL THEN
      SELECT CASE WHEN COALESCE(current_row->>'slot',previous->>'slot')='about_heading'
        THEN left('Über ' || display_name,200) ELSE 'Tätigkeitsbereiche' END INTO heading
        FROM public.company_profiles WHERE id=target;
      empty_slot:=jsonb_build_object('type','heading','slot',COALESCE(current_row->>'slot',previous->>'slot'),
        'content',jsonb_build_object('text',heading));
      IF TG_OP='INSERT' THEN before_content:=empty_slot; END IF;
      IF TG_OP='DELETE' THEN after_content:=empty_slot; END IF;
    END IF;
  END IF;
  IF before_content IS NOT DISTINCT FROM after_content
    AND (former_target IS NULL OR former_target=target) THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  source:=CASE WHEN actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=actor) THEN 'admin'
    WHEN actor IS NOT NULL THEN 'provider'
    WHEN current_setting('app.content_update_source',true)='import' THEN 'import' ELSE 'system' END;
  -- Upsert serializes revision increments with the deliberate review RPC.
  INSERT INTO public.profile_content_freshness(profile_id,content_updated_at,content_updated_by,content_update_source)
    SELECT target,clock_timestamp(),actor,source WHERE EXISTS(SELECT 1 FROM public.company_profiles WHERE id=target)
    ON CONFLICT(profile_id) DO UPDATE SET content_revision=profile_content_freshness.content_revision+1,
      content_updated_at=EXCLUDED.content_updated_at,content_updated_by=EXCLUDED.content_updated_by,
      content_update_source=EXCLUDED.content_update_source;
  IF former_target IS NOT NULL AND former_target<>target THEN
    UPDATE public.profile_content_freshness SET content_revision=content_revision+1,
      content_updated_at=clock_timestamp(),content_updated_by=actor,content_update_source=source
      WHERE profile_id=former_target;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION private.track_profile_content() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER profile_freshness_content AFTER INSERT OR UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();
CREATE TRIGGER profile_freshness_categories AFTER INSERT OR UPDATE OR DELETE ON public.company_profile_categories
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();
CREATE TRIGGER profile_freshness_travel AFTER INSERT OR UPDATE OR DELETE ON public.company_profile_travel_terms
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();
CREATE TRIGGER profile_freshness_gallery AFTER INSERT OR UPDATE OR DELETE ON public.company_profile_images
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();
CREATE TRIGGER profile_freshness_blocks AFTER INSERT OR UPDATE OR DELETE ON public.profile_content_blocks
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();
CREATE TRIGGER profile_freshness_block_images AFTER INSERT OR UPDATE OR DELETE ON public.profile_content_block_images
  FOR EACH ROW EXECUTE FUNCTION private.track_profile_content();

CREATE FUNCTION public.review_profile_content(p_profile_id uuid,p_expected_revision bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_revision bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
  END IF;
  SELECT content_revision INTO current_revision FROM public.profile_content_freshness
    WHERE profile_id=p_profile_id FOR UPDATE;
  IF current_revision IS NULL THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  IF p_expected_revision IS NULL OR p_expected_revision<>current_revision THEN
    RAISE EXCEPTION 'profile changed since review' USING ERRCODE='40001';
  END IF;
  UPDATE public.profile_content_freshness SET reviewed_revision=current_revision,
    reviewed_at=clock_timestamp(),reviewed_by=auth.uid() WHERE profile_id=p_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.review_profile_content(uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_profile_content(uuid,bigint) TO authenticated;

-- Approved public content gets dates only, never actor IDs/revisions/internal state.
CREATE FUNCTION public.public_profile_freshness(p_profile_id uuid)
RETURNS TABLE(content_updated_at timestamptz,checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT f.content_updated_at,CASE WHEN f.reviewed_revision=f.content_revision THEN f.reviewed_at ELSE NULL END
    FROM public.profile_content_freshness f JOIN public.company_profiles p ON p.id=f.profile_id
    WHERE f.profile_id=p_profile_id AND p.status='approved';
$$;
REVOKE ALL ON FUNCTION public.public_profile_freshness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profile_freshness(uuid) TO anon,authenticated;
