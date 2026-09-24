-- Repository-only migration. Do not apply to Supabase Cloud in this work package.
ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_blocks_type_check;
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_blocks_type_check
  CHECK (type IN ('heading', 'text', 'image_grid'));
ALTER TABLE public.profile_content_blocks DROP CONSTRAINT profile_content_text_shape;
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_text_shape CHECK (
  jsonb_typeof(content) = 'object' AND (
    (type = 'image_grid' AND content = '{}'::jsonb) OR
    (type IN ('heading','text') AND content ? 'text'
      AND jsonb_typeof(content -> 'text') = 'string'
      AND char_length(btrim(content ->> 'text')) BETWEEN 1 AND
        CASE WHEN type = 'heading' THEN 200 ELSE 10000 END)
  )
);
ALTER TABLE public.profile_content_blocks ADD CONSTRAINT profile_content_image_config CHECK (
  (type = 'image_grid' AND jsonb_typeof(config -> 'columns') = 'number'
    AND (config ->> 'columns') IN ('1','2','3','4')
    AND config = jsonb_build_object('columns', (config ->> 'columns')::integer))
  OR (type IN ('heading','text') AND config = '{}'::jsonb)
);

CREATE TABLE public.profile_content_block_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.profile_content_blocks(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  alt_text text CHECK (char_length(alt_text) <= 500),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profile_content_block_images_order
  ON public.profile_content_block_images(block_id, sort_order, id);

CREATE FUNCTION public.profile_block_image_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target uuid; parent record; image_count integer;
BEGIN
  target := CASE WHEN TG_OP = 'DELETE' THEN OLD.block_id ELSE NEW.block_id END;
  SELECT b.id, b.profile_id, b.type, b.config INTO parent
    FROM public.profile_content_blocks b WHERE b.id = target FOR UPDATE;
  IF NOT FOUND AND TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NOT FOUND OR parent.type <> 'image_grid' THEN
    RAISE EXCEPTION 'image grid unavailable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.block_id <> OLD.block_id THEN
    RAISE EXCEPTION 'image identity is immutable';
  END IF;
  IF NEW.storage_path !~ ('^profiles/' || parent.profile_id::text || '/blocks/' || target::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') THEN
    RAISE EXCEPTION 'invalid block image path';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO image_count FROM public.profile_content_block_images WHERE block_id = target;
    IF image_count >= 4 OR image_count >= (parent.config ->> 'columns')::integer THEN
      RAISE EXCEPTION 'image grid full';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profile_block_image_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.profile_content_block_images FOR EACH ROW
EXECUTE FUNCTION public.profile_block_image_guard();
REVOKE EXECUTE ON FUNCTION public.profile_block_image_guard() FROM PUBLIC, anon;

CREATE FUNCTION public.profile_image_layout_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.type = 'image_grid' AND (NEW.type <> OLD.type OR NEW.profile_id <> OLD.profile_id) THEN
    RAISE EXCEPTION 'image block identity is immutable';
  END IF;
  IF NEW.type = 'image_grid' AND (NEW.config ->> 'columns')::integer <
    (SELECT count(*) FROM public.profile_content_block_images WHERE block_id = NEW.id) THEN
    RAISE EXCEPTION 'remove images before reducing columns';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profile_image_layout_guard BEFORE UPDATE ON public.profile_content_blocks
FOR EACH ROW EXECUTE FUNCTION public.profile_image_layout_guard();
REVOKE EXECUTE ON FUNCTION public.profile_image_layout_guard() FROM PUBLIC, anon;

ALTER TABLE public.profile_content_block_images ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_content_block_images FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_content_block_images TO anon, authenticated;
GRANT INSERT (block_id, storage_path, alt_text, sort_order)
  ON public.profile_content_block_images TO authenticated;
GRANT UPDATE (alt_text, sort_order, storage_path) ON public.profile_content_block_images TO authenticated;
GRANT DELETE ON public.profile_content_block_images TO authenticated;

CREATE POLICY profile_block_images_public_read ON public.profile_content_block_images
FOR SELECT TO anon, authenticated USING (EXISTS (
  SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
  WHERE b.id = block_id AND b.type = 'image_grid' AND p.status = 'approved'
));
CREATE POLICY profile_block_images_admin_read ON public.profile_content_block_images
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
);
CREATE POLICY profile_block_images_admin_insert ON public.profile_content_block_images
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid' AND p.status = 'approved')
);
CREATE POLICY profile_block_images_admin_update ON public.profile_content_block_images
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid' AND p.status = 'approved')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid' AND p.status = 'approved')
);
CREATE POLICY profile_block_images_admin_delete ON public.profile_content_block_images
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid' AND p.status = 'approved')
);

-- The existing insert RPC keeps its name and text behavior for older clients.
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
      CASE WHEN p_type = 'image_grid' THEN '{"columns":1}'::jsonb ELSE '{}'::jsonb END)
    RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE FUNCTION public.reorder_profile_block_images(
  p_profile_id uuid, p_block_id uuid, p_image_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = p_block_id AND b.profile_id = p_profile_id AND b.type = 'image_grid'
      AND p.status = 'approved' FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'block unavailable'; END IF;
  IF p_image_ids IS NULL OR cardinality(p_image_ids) <>
      (SELECT count(*) FROM public.profile_content_block_images WHERE block_id = p_block_id)
    OR cardinality(p_image_ids) <>
      (SELECT count(DISTINCT id) FROM unnest(p_image_ids) AS t(id))
    OR EXISTS (SELECT 1 FROM unnest(p_image_ids) AS t(id) WHERE NOT EXISTS (
      SELECT 1 FROM public.profile_content_block_images i WHERE i.id = t.id AND i.block_id = p_block_id
    )) THEN RAISE EXCEPTION 'invalid image order'; END IF;
  UPDATE public.profile_content_block_images i SET sort_order = t.ordinality::integer - 1
    FROM unnest(p_image_ids) WITH ORDINALITY AS t(id, ordinality)
    WHERE i.id = t.id AND i.block_id = p_block_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_profile_block_images(uuid,uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_profile_block_images(uuid,uuid,uuid[]) TO authenticated;

CREATE FUNCTION public.remove_profile_block_image(
  p_profile_id uuid, p_block_id uuid, p_image_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE removed_path text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = p_block_id AND b.profile_id = p_profile_id AND b.type = 'image_grid'
      AND p.status = 'approved' FOR UPDATE OF b;
  IF NOT FOUND THEN RAISE EXCEPTION 'block unavailable'; END IF;
  DELETE FROM public.profile_content_block_images
    WHERE id = p_image_id AND block_id = p_block_id RETURNING storage_path INTO removed_path;
  IF removed_path IS NULL THEN RAISE EXCEPTION 'image unavailable'; END IF;
  UPDATE public.profile_content_block_images i SET sort_order = ordered.position - 1
    FROM (SELECT id, row_number() OVER (ORDER BY sort_order, id)::integer AS position
      FROM public.profile_content_block_images WHERE block_id = p_block_id) ordered
    WHERE i.id = ordered.id;
  RETURN removed_path;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_profile_block_image(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_profile_block_image(uuid,uuid,uuid) TO authenticated;

-- Restrict the older owner read policy to its original logo/gallery paths.
ALTER POLICY company_media_owner_read ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/(logo|gallery)/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id::text = (storage.foldername(name))[2] AND c.owner_user_id = (SELECT auth.uid()))
);
CREATE POLICY company_media_block_admin_read ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4] AND b.type = 'image_grid' AND p.status = 'approved')
);
CREATE POLICY company_media_block_admin_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4] AND b.type = 'image_grid' AND p.status = 'approved')
);
CREATE POLICY company_media_block_admin_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4] AND b.type = 'image_grid')
  AND NOT EXISTS (SELECT 1 FROM public.profile_content_block_images i WHERE i.storage_path = name)
);
CREATE POLICY company_media_block_public_read ON storage.objects
FOR SELECT TO anon, authenticated USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.profile_content_block_images i
    JOIN public.profile_content_blocks b ON b.id = i.block_id
    JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE i.storage_path = name AND b.type = 'image_grid' AND p.status = 'approved'
      AND p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4])
);

