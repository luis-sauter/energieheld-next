-- Repository-only migration. Apply to the target database separately after review.
-- Structured profile fields remain the source of truth; two heading slots override labels only.
CREATE TABLE public.profile_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('heading', 'text')),
  slot text CHECK (slot IN ('about_heading', 'business_areas_heading')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  content jsonb NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_content_slot_type CHECK (slot IS NULL OR type = 'heading'),
  CONSTRAINT profile_content_text_shape CHECK (
    jsonb_typeof(content) = 'object'
    AND content ? 'text'
    AND jsonb_typeof(content -> 'text') = 'string'
    AND char_length(btrim(content ->> 'text')) BETWEEN 1 AND
      CASE WHEN type = 'heading' THEN 200 ELSE 10000 END
  ),
  CONSTRAINT profile_content_config_shape CHECK (jsonb_typeof(config) = 'object'),
  CONSTRAINT profile_content_slot_unique UNIQUE (profile_id, slot)
);
CREATE INDEX profile_content_blocks_order
  ON public.profile_content_blocks(profile_id, sort_order, id) WHERE slot IS NULL;

CREATE FUNCTION public.profile_content_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profile_content_updated_at BEFORE UPDATE ON public.profile_content_blocks
FOR EACH ROW EXECUTE FUNCTION public.profile_content_touch_updated_at();
REVOKE EXECUTE ON FUNCTION public.profile_content_touch_updated_at() FROM PUBLIC, anon;

ALTER TABLE public.profile_content_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_content_blocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_content_blocks TO anon, authenticated;
GRANT INSERT (profile_id, type, slot, sort_order, content, config)
  ON public.profile_content_blocks TO authenticated;
GRANT UPDATE (sort_order, content, config) ON public.profile_content_blocks TO authenticated;
GRANT DELETE ON public.profile_content_blocks TO authenticated;

CREATE POLICY profile_content_public_read ON public.profile_content_blocks
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY profile_content_admin_read ON public.profile_content_blocks
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY profile_content_admin_insert ON public.profile_content_blocks
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY profile_content_admin_update ON public.profile_content_blocks
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
CREATE POLICY profile_content_admin_delete ON public.profile_content_blocks
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);

-- Both order functions run with the caller's privileges and remain subject to RLS.
-- Locking the parent serializes normal editorial insert/reorder operations per profile.
CREATE FUNCTION public.insert_profile_content_block(
  p_profile_id uuid, p_type text, p_text text, p_before_block_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE insertion_order integer;
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id AND p.status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;

  IF p_before_block_id IS NULL THEN
    SELECT COALESCE(MAX(sort_order) + 1, 0) INTO insertion_order
      FROM public.profile_content_blocks
      WHERE profile_id = p_profile_id AND slot IS NULL;
  ELSE
    SELECT sort_order INTO insertion_order FROM public.profile_content_blocks
      WHERE id = p_before_block_id AND profile_id = p_profile_id AND slot IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'block does not belong to profile'; END IF;
  END IF;
  UPDATE public.profile_content_blocks SET sort_order = sort_order + 1
    WHERE profile_id = p_profile_id AND slot IS NULL AND sort_order >= insertion_order;
  INSERT INTO public.profile_content_blocks(profile_id, type, sort_order, content)
    VALUES (p_profile_id, p_type, insertion_order, jsonb_build_object('text', p_text))
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.insert_profile_content_block(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_profile_content_block(uuid,text,text,uuid) TO authenticated;

CREATE FUNCTION public.reorder_profile_content_blocks(p_profile_id uuid, p_block_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id AND p.status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile unavailable'; END IF;
  IF p_block_ids IS NULL OR cardinality(p_block_ids) <>
      (SELECT count(*) FROM public.profile_content_blocks WHERE profile_id = p_profile_id AND slot IS NULL)
    OR cardinality(p_block_ids) <>
      (SELECT count(DISTINCT id) FROM unnest(p_block_ids) AS t(id))
    OR EXISTS (SELECT 1 FROM unnest(p_block_ids) AS t(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.profile_content_blocks b
        WHERE b.id = t.id AND b.profile_id = p_profile_id AND b.slot IS NULL
    )) THEN RAISE EXCEPTION 'invalid block order'; END IF;
  UPDATE public.profile_content_blocks b SET sort_order = t.ordinality::integer - 1
    FROM unnest(p_block_ids) WITH ORDINALITY AS t(id, ordinality)
    WHERE b.id = t.id AND b.profile_id = p_profile_id AND b.slot IS NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_profile_content_blocks(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_profile_content_blocks(uuid,uuid[]) TO authenticated;
