-- Extend the existing advertising inventory without changing campaign or directory rows.
ALTER TABLE public.company_ad_campaigns DROP CONSTRAINT company_ad_campaigns_placement_check;
ALTER TABLE public.company_ad_campaigns ADD CONSTRAINT company_ad_campaigns_placement_check
  CHECK (placement IN ('top_banner', 'sidebar_top', 'sidebar_middle', 'sidebar_bottom',
    'sidebar_04', 'sidebar_05', 'sidebar_06', 'sidebar_07', 'sidebar_08',
    'sidebar_09', 'sidebar_10', 'sidebar_11', 'sidebar_12'));

ALTER TABLE public.ad_sidebar_slot_order DROP CONSTRAINT ad_sidebar_slot_order_slot_check;
ALTER TABLE public.ad_sidebar_slot_order ADD CONSTRAINT ad_sidebar_slot_order_slot_check
  CHECK (slot IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom',
    'sidebar_04', 'sidebar_05', 'sidebar_06', 'sidebar_07', 'sidebar_08',
    'sidebar_09', 'sidebar_10', 'sidebar_11', 'sidebar_12'));
ALTER TABLE public.ad_sidebar_slot_order DROP CONSTRAINT ad_sidebar_slot_order_sort_order_check;
ALTER TABLE public.ad_sidebar_slot_order ADD CONSTRAINT ad_sidebar_slot_order_sort_order_check
  CHECK (sort_order BETWEEN 0 AND 11);
INSERT INTO public.ad_sidebar_slot_order (slot, sort_order) VALUES
  ('sidebar_04', 3), ('sidebar_05', 4), ('sidebar_06', 5),
  ('sidebar_07', 6), ('sidebar_08', 7), ('sidebar_09', 8),
  ('sidebar_10', 9), ('sidebar_11', 10), ('sidebar_12', 11);

-- The deployed three-slot client remains valid until rollout finishes.
CREATE OR REPLACE FUNCTION public.reorder_ad_sidebar_slots(p_slots text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE full_order text[];
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.ad_sidebar_slot_order o ORDER BY o.slot FOR UPDATE OF o;
  IF p_slots IS NULL OR cardinality(p_slots) NOT IN (3, 12)
    OR (SELECT count(*) FROM public.ad_sidebar_slot_order) <> 12
    OR cardinality(p_slots) <> (SELECT count(DISTINCT slot) FROM unnest(p_slots) AS t(slot))
    OR EXISTS (SELECT 1 FROM unnest(p_slots) AS t(slot)
      WHERE t.slot IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.ad_sidebar_slot_order o WHERE o.slot = t.slot))
    OR (cardinality(p_slots) = 3 AND EXISTS (
      SELECT 1 FROM unnest(p_slots) AS t(slot)
      WHERE t.slot NOT IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom')))
  THEN RAISE EXCEPTION 'sidebar changed; reload' USING ERRCODE = '22023'; END IF;

  IF cardinality(p_slots) = 3 THEN
    SELECT p_slots || array_agg(o.slot ORDER BY o.sort_order, o.slot)
      INTO full_order FROM public.ad_sidebar_slot_order o
      WHERE o.slot NOT IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom');
  ELSE
    full_order := p_slots;
  END IF;
  UPDATE public.ad_sidebar_slot_order o
  SET sort_order = t.position::integer - 1, updated_at = now()
  FROM unnest(full_order) WITH ORDINALITY AS t(slot, position)
  WHERE o.slot = t.slot;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_ad_sidebar_slots(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_ad_sidebar_slots(text[]) TO authenticated;

ALTER TABLE public.company_ad_campaign_targets DROP CONSTRAINT company_ad_campaign_targets_target_type_check;
ALTER TABLE public.company_ad_campaign_targets ADD CONSTRAINT company_ad_campaign_targets_target_type_check
  CHECK (target_type IN ('homepage', 'experts_directory', 'trade'));
ALTER TABLE public.company_ad_campaign_targets DROP CONSTRAINT ad_target_shape;
ALTER TABLE public.company_ad_campaign_targets ADD CONSTRAINT ad_target_shape CHECK (
  (target_type IN ('homepage', 'experts_directory') AND category_id IS NULL) OR
  (target_type = 'trade' AND category_id IS NOT NULL AND public.is_energyheld_category_id(category_id)));

-- Keep the existing owner, target-assignment, URL and private-media checks intact.
CREATE OR REPLACE FUNCTION public.save_ad_campaign(p_campaign_id uuid,p_data jsonb,p_submit boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE campaign public.company_ad_campaigns; media text; destination text; targets jsonb;
BEGIN
 SELECT a.* INTO campaign FROM public.company_ad_campaigns a JOIN public.company_profiles p ON p.id=a.profile_id JOIN public.companies c ON c.id=p.company_id
 WHERE a.id=p_campaign_id AND c.owner_user_id=auth.uid() FOR UPDATE OF a;
 IF NOT FOUND OR campaign.status NOT IN ('draft','rejected') THEN RAISE EXCEPTION 'not editable'; END IF;
 targets := p_data->'targets';
 IF targets IS NULL OR jsonb_typeof(targets)<>'array' THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF jsonb_array_length(targets)<1 OR jsonb_array_length(targets)>16 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE jsonb_typeof(t)<>'object'
   OR (t->>'target_type') IS NULL OR t->>'target_type' NOT IN ('homepage','experts_directory','trade')
   OR (t->>'target_type' IN ('homepage','experts_directory') AND t->>'category_id' IS NOT NULL)
   OR (t->>'target_type'='trade' AND (t->>'category_id' IS NULL OR NOT public.is_energyheld_category_id(t->>'category_id'))))
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 PERFORM 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id
   AND pc.category_id IN (SELECT t->>'category_id' FROM jsonb_array_elements(targets) t) FOR SHARE;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(targets) t WHERE t->>'target_type'='trade'
   AND NOT EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=campaign.profile_id AND pc.category_id=t->>'category_id'))
 THEN RAISE EXCEPTION 'ad_target_not_assigned'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(targets)) <> (SELECT count(DISTINCT (t->>'target_type',t->>'category_id')) FROM jsonb_array_elements(targets) t)
 THEN RAISE EXCEPTION 'invalid_ad_targets'; END IF;
 DELETE FROM public.company_ad_campaign_targets WHERE campaign_id=campaign.id;
 INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,category_id)
 SELECT campaign.id,t->>'target_type',t->>'category_id' FROM jsonb_array_elements(targets) t;
 media := nullif(p_data->>'image_path',''); destination := btrim(p_data->>'target_url');
 IF coalesce(length(btrim(p_data->>'internal_name')),0)=0 OR coalesce(length(btrim(p_data->>'headline')),0)=0
 OR destination IS NULL OR destination !~* '^https?://([a-z0-9]([a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' THEN RAISE EXCEPTION 'invalid creative'; END IF;
 IF media IS NOT NULL AND (media !~ ('^campaigns/'||campaign.id::text||'/creative/[0-9a-f-]{36}\.(jpg|png|webp)$') OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media' AND name=media)) THEN RAISE EXCEPTION 'invalid media'; END IF;
 IF p_submit AND media IS NULL THEN RAISE EXCEPTION 'image required'; END IF;
 UPDATE public.company_ad_campaigns SET
 internal_name=btrim(p_data->>'internal_name'), placement=p_data->>'placement',
 requested_start_date=(p_data->>'requested_start_date')::date, requested_end_date=(p_data->>'requested_end_date')::date,
 headline=btrim(p_data->>'headline'), body_text=nullif(btrim(p_data->>'body_text'),''),target_url=destination,image_path=media,
 status=CASE WHEN p_submit THEN 'pending' ELSE 'draft' END,
 submitted_at=CASE WHEN p_submit THEN clock_timestamp() ELSE submitted_at END, updated_at=clock_timestamp()
 WHERE id=campaign.id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_active_ad_campaigns(p_scope_type text,p_category_id text DEFAULT NULL)
RETURNS TABLE(id uuid,placement text,headline text,body_text text,target_url text,image_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path FROM public.company_ad_campaigns a
 WHERE a.status='approved' AND (now() AT TIME ZONE 'Europe/Berlin')::date BETWEEN a.approved_start_date AND a.approved_end_date
 AND EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t WHERE t.campaign_id=a.id AND
   ((p_scope_type='homepage' AND p_category_id IS NULL AND t.target_type='homepage') OR
    (p_scope_type='experts_directory' AND p_category_id IS NULL AND t.target_type='experts_directory') OR
    (p_scope_type='trade' AND public.is_energyheld_category_id(p_category_id) AND t.target_type='trade' AND t.category_id=p_category_id
      AND EXISTS (SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=a.profile_id AND pc.category_id=t.category_id))))
 ORDER BY a.placement,a.id;
$$;
-- CREATE OR REPLACE retains the restricted grants on both existing functions.
