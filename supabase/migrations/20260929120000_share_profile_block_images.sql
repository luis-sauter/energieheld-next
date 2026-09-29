-- A duplicated image block references the same object. Its rows retain independent
-- captions, crop and replacement paths. No object is copied in Storage.
ALTER TABLE public.profile_content_block_images
  DROP CONSTRAINT profile_content_block_images_storage_path_key;
CREATE INDEX profile_content_block_images_storage_path_idx
  ON public.profile_content_block_images(storage_path);
CREATE UNIQUE INDEX profile_content_block_images_block_path_key
  ON public.profile_content_block_images(block_id, storage_path);

CREATE OR REPLACE FUNCTION public.profile_block_image_guard() RETURNS trigger
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
  IF NEW.storage_path !~ ('^profiles/' || parent.profile_id::text || '/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$')
    OR (NEW.storage_path !~ ('^profiles/' || parent.profile_id::text || '/blocks/' || target::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_content_block_images i
        JOIN public.profile_content_blocks b ON b.id = i.block_id
        WHERE i.storage_path = NEW.storage_path AND b.profile_id = parent.profile_id
      )) THEN
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

-- SECURITY INVOKER keeps the existing admin/RLS checks. The RPC is atomic:
-- a failed image insert rolls back the newly duplicated block as well.
CREATE OR REPLACE FUNCTION public.duplicate_profile_content_block(
  p_profile_id uuid, p_block_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE original public.profile_content_blocks%ROWTYPE; new_id uuid; source_image record; new_image_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p WHERE p.id = p_profile_id FOR UPDATE;
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
  IF original.type = 'image_grid' THEN
    FOR source_image IN SELECT * FROM public.profile_content_block_images
      WHERE block_id = original.id ORDER BY sort_order, id LOOP
      INSERT INTO public.profile_content_block_images(block_id,storage_path,alt_text,sort_order)
        VALUES (new_id,source_image.storage_path,source_image.alt_text,source_image.sort_order)
        RETURNING id INTO new_image_id;
      UPDATE public.profile_content_block_images SET
        focus_x = source_image.focus_x, focus_y = source_image.focus_y,
        zoom = source_image.zoom, caption = source_image.caption
        WHERE id = new_image_id AND block_id = new_id;
    END LOOP;
  END IF;
  RETURN new_id;
END;
$$;

-- Reading remains limited to approved profiles. Deleting an unreferenced
-- object remains admin-only, even if its original block was deleted earlier.
ALTER POLICY company_media_block_public_read ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.profile_content_block_images i
    JOIN public.profile_content_blocks b ON b.id = i.block_id
    JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE i.storage_path = name AND b.type = 'image_grid' AND p.status = 'approved'
      AND p.id::text = (storage.foldername(name))[2])
);
ALTER POLICY company_media_block_admin_read ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id::text = (storage.foldername(name))[2])
);
ALTER POLICY company_media_block_admin_delete ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p
    WHERE p.id::text = (storage.foldername(name))[2])
  AND NOT EXISTS (SELECT 1 FROM public.profile_content_block_images i WHERE i.storage_path = name)
);
