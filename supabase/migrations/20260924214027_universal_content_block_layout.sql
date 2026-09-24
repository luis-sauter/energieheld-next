-- Free blocks share one full-content-width layout. Template heading slots stay unchanged.
ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_image_config;

UPDATE public.profile_content_blocks
SET config = CASE
  WHEN type = 'image_grid' THEN config || '{"offset_percent":0,"spacing_top":"normal","spacing_bottom":"normal"}'::jsonb
  ELSE '{"width_percent":100,"offset_percent":0,"text_align":"left","spacing_top":"normal","spacing_bottom":"normal"}'::jsonb
END
WHERE slot IS NULL;

ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_image_config CHECK (
  (slot IS NOT NULL AND type = 'heading' AND config = '{}'::jsonb)
  OR (slot IS NULL AND
    jsonb_typeof(config -> 'width_percent') = 'number'
    AND (config ->> 'width_percent')::numeric BETWEEN 25 AND 100
    AND (config ->> 'width_percent')::numeric = trunc((config ->> 'width_percent')::numeric)
    AND jsonb_typeof(config -> 'offset_percent') = 'number'
    AND (config ->> 'offset_percent')::numeric >= 0
    AND (config ->> 'offset_percent')::numeric * 10 = trunc((config ->> 'offset_percent')::numeric * 10)
    AND (config ->> 'width_percent')::numeric + (config ->> 'offset_percent')::numeric <= 100
    AND config ->> 'spacing_top' IN ('small', 'normal', 'large')
    AND config ->> 'spacing_bottom' IN ('small', 'normal', 'large')
    AND (
      (type IN ('heading','text')
        AND config ->> 'text_align' IN ('left','center','right')
        AND config = jsonb_build_object(
          'width_percent', (config ->> 'width_percent')::integer,
          'offset_percent', (config ->> 'offset_percent')::numeric,
          'text_align', config ->> 'text_align',
          'spacing_top', config ->> 'spacing_top',
          'spacing_bottom', config ->> 'spacing_bottom'))
      OR (type = 'image_grid'
        AND jsonb_typeof(config -> 'columns') = 'number'
        AND (config ->> 'columns') IN ('1','2','3','4')
        AND jsonb_typeof(config -> 'aspect_ratio') = 'number'
        AND (config ->> 'aspect_ratio')::numeric BETWEEN 0.6 AND 3
        AND (config ->> 'aspect_ratio')::numeric * 100 = trunc((config ->> 'aspect_ratio')::numeric * 100)
        AND config = jsonb_build_object(
          'columns', (config ->> 'columns')::integer,
          'width_percent', (config ->> 'width_percent')::integer,
          'offset_percent', (config ->> 'offset_percent')::numeric,
          'aspect_ratio', (config ->> 'aspect_ratio')::numeric,
          'spacing_top', config ->> 'spacing_top',
          'spacing_bottom', config ->> 'spacing_bottom'))
    )
  )
);

CREATE OR REPLACE FUNCTION public.insert_profile_content_block(
  p_profile_id uuid, p_type text, p_text text, p_before_block_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE insertion_order integer; new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id AND p.status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  IF p_before_block_id IS NULL THEN
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO insertion_order
      FROM public.profile_content_blocks WHERE profile_id = p_profile_id AND slot IS NULL;
  ELSE
    SELECT sort_order INTO insertion_order FROM public.profile_content_blocks
      WHERE id = p_before_block_id AND profile_id = p_profile_id AND slot IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'block does not belong to profile'; END IF;
  END IF;
  UPDATE public.profile_content_blocks SET sort_order = sort_order + 1
    WHERE profile_id = p_profile_id AND slot IS NULL AND sort_order >= insertion_order;
  INSERT INTO public.profile_content_blocks(profile_id, type, sort_order, content, config)
    VALUES (p_profile_id, p_type, insertion_order,
      CASE WHEN p_type = 'image_grid' THEN '{}'::jsonb ELSE jsonb_build_object('text', p_text) END,
      CASE WHEN p_type = 'image_grid'
        THEN '{"columns":1,"width_percent":100,"offset_percent":0,"aspect_ratio":1.5,"spacing_top":"normal","spacing_bottom":"normal"}'::jsonb
        ELSE '{"width_percent":100,"offset_percent":0,"text_align":"left","spacing_top":"normal","spacing_bottom":"normal"}'::jsonb END)
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- The duplicate is inserted atomically immediately after its source. Image rows are
-- intentionally not copied: sharing Storage objects would break later cleanup.
CREATE FUNCTION public.duplicate_profile_content_block(
  p_profile_id uuid, p_block_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE original public.profile_content_blocks%ROWTYPE; new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id AND p.status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  SELECT * INTO original FROM public.profile_content_blocks
    WHERE id = p_block_id AND profile_id = p_profile_id AND slot IS NULL
      AND type IN ('heading','text','image_grid');
  IF NOT FOUND THEN RAISE EXCEPTION 'block does not belong to profile'; END IF;
  UPDATE public.profile_content_blocks SET sort_order = sort_order + 1
    WHERE profile_id = p_profile_id AND slot IS NULL AND sort_order > original.sort_order;
  INSERT INTO public.profile_content_blocks(profile_id,type,sort_order,content,config)
    VALUES (p_profile_id,original.type,original.sort_order + 1,original.content,original.config)
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.duplicate_profile_content_block(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_profile_content_block(uuid,uuid) TO authenticated;
