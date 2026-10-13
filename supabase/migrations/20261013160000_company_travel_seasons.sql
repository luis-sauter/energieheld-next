BEGIN;
-- No existing assignments, descriptions, media or publication states are changed.
-- Seasons are editorial travel themes, kept separate from the fixed Mottoreisen menu.
INSERT INTO public.travel_terms(term_key,dimension,slug,label) VALUES
 ('theme:saison-fruehling','theme','saison-fruehling','Frühling'),
 ('theme:saison-sommer','theme','saison-sommer','Sommer'),
 ('theme:saison-herbst','theme','saison-herbst','Herbst'),
 ('theme:saison-winter','theme','saison-winter','Winter');

ALTER TABLE public.company_profile_travel_terms ADD COLUMN seasonal_teaser text;
ALTER TABLE public.company_profile_travel_terms ADD CONSTRAINT seasonal_teaser_valid CHECK (
 seasonal_teaser IS NULL OR (
 term_key IN ('theme:saison-fruehling','theme:saison-sommer','theme:saison-herbst','theme:saison-winter')
 AND char_length(seasonal_teaser) BETWEEN 1 AND 240 AND seasonal_teaser=btrim(seasonal_teaser)));
GRANT SELECT(seasonal_teaser) ON public.company_profile_travel_terms TO anon,authenticated;
GRANT UPDATE(seasonal_teaser) ON public.company_profile_travel_terms TO authenticated;
CREATE POLICY profile_travel_teaser_admin_update ON public.company_profile_travel_terms
 FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid())));
-- Public reading continues to use the existing public-profile visibility RLS.
-- UPDATE grants only the new column; owners cannot edit confirmed assignments.

CREATE FUNCTION public.save_profile_travel_seasons(
 p_profile_id uuid,p_terms text[],p_expected_terms text[],p_expected_proposals text[],
 p_expected_revision bigint,p_teasers jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF p_teasers IS NULL OR jsonb_typeof(p_teasers)<>'object' THEN RAISE EXCEPTION 'invalid seasonal teasers' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_teasers) v WHERE
  v.key NOT IN ('theme:saison-fruehling','theme:saison-sommer','theme:saison-herbst','theme:saison-winter')
  OR NOT coalesce(v.key=ANY(p_terms),false) OR jsonb_typeof(v.value)<>'string'
  OR char_length(v.value#>>'{}')>240)
 THEN RAISE EXCEPTION 'invalid seasonal teasers' USING ERRCODE='22023'; END IF;
 -- Existing verified admin authorization, profile/freshness locks and optimistic
 -- revision/proposal/assignment checks remain the single source of write semantics.
 result := public.save_profile_travel_assignments(p_profile_id,p_terms,p_expected_terms,p_expected_proposals,p_expected_revision);
 UPDATE public.company_profile_travel_terms t SET seasonal_teaser=nullif(btrim(p_teasers->>t.term_key),'')
 WHERE t.profile_id=p_profile_id
 AND t.term_key IN ('theme:saison-fruehling','theme:saison-sommer','theme:saison-herbst','theme:saison-winter')
 AND t.seasonal_teaser IS DISTINCT FROM nullif(btrim(p_teasers->>t.term_key),'');
 RETURN result || jsonb_build_object(
  'revision',(SELECT content_revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id),
  'seasonTeasers',coalesce((SELECT jsonb_object_agg(term_key,seasonal_teaser) FROM public.company_profile_travel_terms
    WHERE profile_id=p_profile_id AND seasonal_teaser IS NOT NULL),'{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.save_profile_travel_seasons(uuid,text[],text[],text[],bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_profile_travel_seasons(uuid,text[],text[],text[],bigint,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_profile_travel_review(p_profile_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.company_profiles WHERE id=p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
 RETURN jsonb_build_object(
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('term_key',term_key,'dimension',dimension,'label',label) ORDER BY dimension,label,term_key) FROM public.travel_terms),'[]'::jsonb),
  'assignedKeys',ARRAY(SELECT term_key FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id ORDER BY term_key),
  'proposedKeys',ARRAY(SELECT term_key FROM public.company_profile_travel_proposals WHERE profile_id=p_profile_id ORDER BY term_key),
  'revision',(SELECT content_revision FROM public.profile_content_freshness WHERE profile_id=p_profile_id),
  'seasonTeasers',coalesce((SELECT jsonb_object_agg(term_key,seasonal_teaser) FROM public.company_profile_travel_terms WHERE profile_id=p_profile_id AND seasonal_teaser IS NOT NULL),'{}'::jsonb));
END;
$$;
-- Existing function privileges are retained; no additional executable definer.
-- Only the travel projection adds seasonal_teaser; every other projection is unchanged.
CREATE OR REPLACE FUNCTION private.track_profile_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

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

        'street','postal_code','city','region','country','logo_path','logo_url','video_path','contact_first_name','contact_last_name','contact_image_path'];

      target := COALESCE(current_row->>'id',previous->>'id')::uuid;

      IF TG_OP='DELETE' THEN RETURN OLD; END IF;

    WHEN 'company_profile_categories' THEN keys:=ARRAY['category_id'];

    WHEN 'company_profile_travel_terms' THEN keys:=ARRAY['term_key','seasonal_teaser'];

    WHEN 'company_profile_images' THEN keys:=ARRAY['storage_path','alt_text'];

    WHEN 'profile_content_blocks' THEN keys:=ARRAY['type','slot'];

    WHEN 'profile_video_uses' THEN keys:=ARRAY['asset_id','block_id','storage_path','external_url'];
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

      jsonb_strip_nulls(jsonb_build_object('text',previous->'content'->'text','title',previous->'content'->'title',

        'hidden',NULLIF(previous->'content'->'hidden','false'::jsonb),

        'heading_hidden',NULLIF(previous->'content'->'heading_hidden','false'::jsonb),

        'hidden_blocks',NULLIF(previous->'content'->'hidden_blocks','[]'::jsonb),

        'deleted_sections',NULLIF(previous->'content'->'deleted_sections','[]'::jsonb))));

    after_content:=after_content || jsonb_build_object('content',

      jsonb_strip_nulls(jsonb_build_object('text',current_row->'content'->'text','title',current_row->'content'->'title',

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

$function$;
COMMIT;
