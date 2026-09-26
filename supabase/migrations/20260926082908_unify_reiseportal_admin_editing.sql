-- Unclaimed editorial inventory has no synthetic Auth owner. The existing
-- UNIQUE constraint and owner predicates remain unchanged.
ALTER TABLE public.companies ALTER COLUMN owner_user_id DROP NOT NULL;

-- Energy trades do not describe travel accommodation. An approved, unclaimed
-- editorial profile can therefore have no company_profile_categories rows.
CREATE OR REPLACE FUNCTION public.check_company_category_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE checked_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'company_profiles' THEN
    IF NEW.status <> 'approved' THEN RETURN NULL; END IF;
    checked_id := NEW.id;
  ELSE checked_id := OLD.profile_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = checked_id AND p.status = 'approved' AND c.owner_user_id IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1 FROM public.company_profile_categories WHERE profile_id = checked_id
  ) THEN
    RAISE EXCEPTION 'approved profile requires at least one category';
  END IF;
  RETURN NULL;
END;
$$;

-- Public SELECT and owner policies are deliberately untouched. Every changed
-- policy still requires a live portal_admins row and a matching profile/block.
ALTER POLICY profile_content_admin_insert ON public.profile_content_blocks WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id)
);
ALTER POLICY profile_content_admin_update ON public.profile_content_blocks USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id)
);
ALTER POLICY profile_content_admin_delete ON public.profile_content_blocks USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id = profile_id)
);
ALTER POLICY profile_block_images_admin_insert ON public.profile_content_block_images WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid')
);
ALTER POLICY profile_block_images_admin_update ON public.profile_content_block_images USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid')
);
ALTER POLICY profile_block_images_admin_delete ON public.profile_content_block_images USING (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = block_id AND b.type = 'image_grid')
);

ALTER POLICY company_media_block_admin_read ON storage.objects USING (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4] AND b.type = 'image_grid')
);
ALTER POLICY company_media_block_admin_insert ON storage.objects WITH CHECK (
  bucket_id = 'company-media'
  AND name ~ '^profiles/[0-9a-f-]{36}/blocks/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE p.id::text = (storage.foldername(name))[2]
      AND b.id::text = (storage.foldername(name))[4] AND b.type = 'image_grid')
);

-- The five verified preview records are inserted below after the admin RPCs.

-- Preserve the existing SECURITY INVOKER RPC checks and exact target validation;
-- only remove the publication-status prerequisite.


CREATE OR REPLACE FUNCTION public.insert_profile_content_block(
  p_profile_id uuid, p_type text, p_text text, p_before_block_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE insertion_order integer; new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id FOR UPDATE;
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


CREATE OR REPLACE FUNCTION public.duplicate_profile_content_block(
  p_profile_id uuid, p_block_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE original public.profile_content_blocks%ROWTYPE; new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id FOR UPDATE;
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


CREATE OR REPLACE FUNCTION public.reorder_profile_content_blocks(p_profile_id uuid, p_block_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.company_profiles p
    WHERE p.id = p_profile_id FOR UPDATE;
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


CREATE OR REPLACE FUNCTION public.reorder_profile_block_images(
  p_profile_id uuid, p_block_id uuid, p_image_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = p_block_id AND b.profile_id = p_profile_id AND b.type = 'image_grid'
      FOR UPDATE OF b;
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


CREATE OR REPLACE FUNCTION public.remove_profile_block_image(
  p_profile_id uuid, p_block_id uuid, p_image_id uuid
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE removed_path text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profile_content_blocks b JOIN public.company_profiles p ON p.id = b.profile_id
    WHERE b.id = p_block_id AND b.profile_id = p_profile_id AND b.type = 'image_grid'
      FOR UPDATE OF b;
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

-- Only the five provider-checked preview entries are imported. Empty source
-- fields stay NULL, and no energy-trade assignment or fabricated image is made.
WITH source(slug, name, tagline, street, postal_code, city, country, phone, website) AS (
  VALUES
    ('bayerischer-wald', 'Bayerischer Wald', 'Endlose Wiesen, grüne Wälder und Natur soweit das Auge reicht.', 'Weiherweg 5 a – 11 b', '94556', 'Neuschönau', 'Deutschland', '0171/4082656', 'https://www.ferienanlage-am-nationalpark.de/'),
    ('hoeflehner', 'Höflehner', 'Erleben Sie kulinarische Highlights und ein umfangreiches Angebot an Aktivitäten und Entspannungsmöglichkeiten.', 'Gumpenberg 2', '8967', 'Haus/Ennstal', 'Österreich', '+43 3686 2548', 'https://www.hoeflehner.com/'),
    ('pension-sonnenhof', 'Pension Sonnenhof', 'Der Sonnenhof am Logenplatz in Meransen. Urlaub in der Ski- & Almenregion Gitschberg Jochtal.', 'Lindenstrasse 10', '39037', 'Mühlbach', 'Italien', '+39 0472 520164', 'https://www.pension-sonnenhof.info/'),
    ('schafhuber', 'Schafhuber', 'Viele Wege führen ins Salzburgerland, dort wo der Himmel die Erde berührt …', 'Urslaustraße 4-6', '5761', 'Maria Alm-Hinterthal', 'Österreich', '+43 6584 8147-0', 'https://www.landhotel-schafhuber.at'),
    ('villner-hof', 'Villner Hof', 'Der „Villner Hof“ befindet sich inmitten von Obst- und Weingärten, in sonniger Lage.', 'Villnerstraße 30', '39044', 'Vill bei Neumarkt', 'Italien', '+39 0471 812 039', NULL)
), new_companies AS (
  INSERT INTO public.companies (owner_user_id, legal_name)
  SELECT NULL, s.name FROM source s
  WHERE NOT EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.slug = s.slug)
  RETURNING id, legal_name
)
INSERT INTO public.company_profiles
  (company_id, slug, display_name, tagline, street, postal_code, city, country, phone, website, status, approved_at)
SELECT c.id, s.slug, s.name, s.tagline, s.street, s.postal_code, s.city, s.country, s.phone, s.website, 'approved', now()
FROM source s JOIN new_companies c ON c.legal_name = s.name;
