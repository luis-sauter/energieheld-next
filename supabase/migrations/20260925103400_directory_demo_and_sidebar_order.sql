-- Extend the existing directory positions without changing their real-profile values.
ALTER TABLE public.company_directory_order DROP CONSTRAINT company_directory_order_pkey;
ALTER TABLE public.company_directory_order ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE public.company_directory_order ADD COLUMN demo_slug text;
ALTER TABLE public.company_directory_order ADD COLUMN item_key text
  GENERATED ALWAYS AS (
    CASE WHEN profile_id IS NOT NULL THEN 'profile:' || profile_id::text
      ELSE 'demo:' || demo_slug END
  ) STORED;
ALTER TABLE public.company_directory_order ADD CONSTRAINT directory_order_one_identity
  CHECK ((profile_id IS NOT NULL AND demo_slug IS NULL)
    OR (profile_id IS NULL AND demo_slug IS NOT NULL));
ALTER TABLE public.company_directory_order ADD CONSTRAINT directory_order_demo_slug_valid
  CHECK (demo_slug IS NULL OR
    (char_length(demo_slug) <= 100 AND demo_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
ALTER TABLE public.company_directory_order ADD CONSTRAINT company_directory_order_pkey
  PRIMARY KEY (item_key);

GRANT SELECT (demo_slug, item_key) ON public.company_directory_order TO anon, authenticated;
GRANT INSERT (demo_slug) ON public.company_directory_order TO authenticated;

ALTER POLICY directory_order_public_read ON public.company_directory_order USING (
  demo_slug IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved')
);
ALTER POLICY directory_order_admin_insert ON public.company_directory_order WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND (demo_slug IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved'))
);
ALTER POLICY directory_order_admin_update ON public.company_directory_order WITH CHECK (
  EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  AND (demo_slug IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.company_profiles p
    WHERE p.id = profile_id AND p.status = 'approved'))
);

WITH demo(slug, position) AS (VALUES
  ('mueller-haustechnik', 0),
  ('sonnenwerk-oberland', 1),
  ('klarblick-energieberatung', 2),
  ('holz-dach-berger', 3),
  ('elektro-lichtpunkt', 4),
  ('fensterwerk-isartal', 5),
  ('waermezeit-bayern', 6),
  ('dachraum-muenchen', 7)
)
INSERT INTO public.company_directory_order (demo_slug, sort_order)
SELECT demo.slug,
  (SELECT coalesce(max(sort_order), -1) + 1 FROM public.company_directory_order) + demo.position
FROM demo ORDER BY demo.position;

-- Exact-permutation validation covers both currently approved profiles and seeded demos.
CREATE FUNCTION public.reorder_company_directory_items(p_item_keys text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.company_profiles p
    WHERE p.status = 'approved' ORDER BY p.id FOR UPDATE OF p;
  PERFORM 1 FROM public.company_directory_order o
    ORDER BY o.item_key FOR UPDATE OF o;

  IF p_item_keys IS NULL
    OR cardinality(p_item_keys) <> (
      SELECT count(*) FROM public.company_profiles WHERE status = 'approved') + (
      SELECT count(*) FROM public.company_directory_order WHERE demo_slug IS NOT NULL)
    OR cardinality(p_item_keys) <> (
      SELECT count(DISTINCT item_key) FROM unnest(p_item_keys) AS t(item_key))
    OR EXISTS (
      SELECT 1 FROM unnest(p_item_keys) AS t(item_key)
      WHERE t.item_key IS NULL OR NOT (
        EXISTS (SELECT 1 FROM public.company_profiles p
          WHERE p.status = 'approved' AND t.item_key = 'profile:' || p.id::text)
        OR EXISTS (SELECT 1 FROM public.company_directory_order o
          WHERE o.demo_slug IS NOT NULL AND o.item_key = t.item_key))
    ) THEN
    RAISE EXCEPTION 'directory changed; reload' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.company_directory_order (profile_id, demo_slug, sort_order)
  SELECT p.id, d.demo_slug, t.ordinality::integer - 1
  FROM unnest(p_item_keys) WITH ORDINALITY AS t(item_key, ordinality)
  LEFT JOIN public.company_profiles p
    ON p.status = 'approved' AND t.item_key = 'profile:' || p.id::text
  LEFT JOIN public.company_directory_order d
    ON d.demo_slug IS NOT NULL AND d.item_key = t.item_key
  ON CONFLICT (item_key) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_company_directory_items(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_company_directory_items(text[]) TO authenticated;

-- The previous deployed client can still submit real UUIDs during rollout.
CREATE OR REPLACE FUNCTION public.reorder_company_directory_profiles(p_profile_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF p_profile_ids IS NULL THEN
    RAISE EXCEPTION 'directory changed; reload' USING ERRCODE = '22023';
  END IF;
  PERFORM public.reorder_company_directory_items(
    ARRAY(SELECT 'profile:' || t.id::text
      FROM unnest(p_profile_ids) WITH ORDINALITY AS t(id, position)
      ORDER BY t.position)
    || ARRAY(SELECT o.item_key FROM public.company_directory_order o
      WHERE o.demo_slug IS NOT NULL ORDER BY o.sort_order, o.item_key)
  );
END;
$$;

-- Sidebar order affects presentation only; campaign placement never changes.
CREATE TABLE public.ad_sidebar_slot_order (
  slot text PRIMARY KEY CHECK (slot IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom')),
  sort_order integer NOT NULL CHECK (sort_order BETWEEN 0 AND 2),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ad_sidebar_slot_order (slot, sort_order) VALUES
  ('sidebar_top', 0), ('sidebar_middle', 1), ('sidebar_bottom', 2);
ALTER TABLE public.ad_sidebar_slot_order ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_sidebar_slot_order FROM PUBLIC, anon, authenticated;
GRANT SELECT (slot, sort_order, updated_at) ON public.ad_sidebar_slot_order TO anon, authenticated;
GRANT UPDATE (sort_order, updated_at) ON public.ad_sidebar_slot_order TO authenticated;
CREATE POLICY sidebar_order_public_read ON public.ad_sidebar_slot_order
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sidebar_order_admin_update ON public.ad_sidebar_slot_order
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id = (SELECT auth.uid()))
  );

CREATE FUNCTION public.reorder_ad_sidebar_slots(p_slots text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.portal_admins a WHERE a.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501'; END IF;

  PERFORM 1 FROM public.ad_sidebar_slot_order o
    ORDER BY o.slot FOR UPDATE OF o;
  IF p_slots IS NULL OR cardinality(p_slots) <> 3
    OR (SELECT count(*) FROM public.ad_sidebar_slot_order) <> 3
    OR cardinality(p_slots) <> (
      SELECT count(DISTINCT slot) FROM unnest(p_slots) AS t(slot))
    OR EXISTS (SELECT 1 FROM unnest(p_slots) AS t(slot)
      WHERE t.slot IS NULL OR t.slot NOT IN (
        'sidebar_top', 'sidebar_middle', 'sidebar_bottom')) THEN
    RAISE EXCEPTION 'sidebar changed; reload' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ad_sidebar_slot_order o
  SET sort_order = t.position::integer - 1, updated_at = now()
  FROM unnest(p_slots) WITH ORDINALITY AS t(slot, position)
  WHERE o.slot = t.slot;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_ad_sidebar_slots(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_ad_sidebar_slots(text[]) TO authenticated;
