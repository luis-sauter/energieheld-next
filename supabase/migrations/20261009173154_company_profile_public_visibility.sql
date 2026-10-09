-- Reversible presentation visibility; no profile, booking or media rows are changed.
CREATE TABLE public.company_profile_public_visibility (
 profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 is_listed boolean NOT NULL DEFAULT true
);
ALTER TABLE public.company_profile_public_visibility ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_profile_public_visibility FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.company_profile_public_visibility TO anon,authenticated;
GRANT INSERT(profile_id,is_listed),UPDATE(profile_id,is_listed) ON public.company_profile_public_visibility TO authenticated;
CREATE POLICY profile_visibility_public_read ON public.company_profile_public_visibility FOR SELECT TO anon,authenticated
 USING (EXISTS(SELECT 1 FROM public.company_profiles p WHERE p.id=profile_id AND p.status='approved'));
CREATE POLICY profile_visibility_admin_read ON public.company_profile_public_visibility FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE POLICY profile_visibility_admin_insert ON public.company_profile_public_visibility FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE POLICY profile_visibility_admin_update ON public.company_profile_public_visibility FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
-- Preserve every existing document rule, projection and invoker/barrier security.
CREATE OR REPLACE VIEW public.portal_search_documents WITH (security_invoker=true,security_barrier=true) AS
 WITH profiles AS (
         SELECT p.id,
            p.slug,
            p.display_name,
            p.tagline,
            p.description,
            p.business_areas,
            p.city,
            p.region,
            p.country,
            p.street,
            p.postal_code,
            p.phone,
            p.public_email,
            p.website,
            p.id = '31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid AND p.slug = 'energieheld-demo-gmbh-c3351d59'::text AS demo
           FROM company_profiles p
          WHERE p.status = 'approved'::text AND NOT EXISTS (SELECT 1 FROM public.company_profile_public_visibility v WHERE v.profile_id=p.id AND NOT v.is_listed) AND (p.id = '31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid AND p.slug = 'energieheld-demo-gmbh-c3351d59'::text OR p.slug <> 'energieheld-demo-gmbh-c3351d59'::text AND NOT (EXISTS ( SELECT 1
                   FROM company_profile_categories pc
                  WHERE pc.profile_id = p.id)) AND ((((((COALESCE(p.display_name, ''::text) || ' '::text) || COALESCE(p.tagline, ''::text)) || ' '::text) || COALESCE(p.description, ''::text)) || ' '::text) || COALESCE(p.business_areas, ''::text)) !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung'::text)
        ), documents AS (
         SELECT p.id,
                CASE
                    WHEN p.demo THEN '/unterkuenfte/demo-gmbh'::text
                    ELSE '/unterkuenfte/'::text || p.slug
                END AS url,
                CASE
                    WHEN p.demo THEN 'Demo GmbH'::text
                    ELSE p.display_name
                END AS title,
            concat_ws(' '::text, p.city, p.postal_code,
                CASE
                    WHEN p.region = 'Bayern'::text AND p.country IS NOT NULL AND p.country <> 'Deutschland'::text THEN ''::text
                    ELSE p.region
                END, p.country, p.street) AS location,
            COALESCE(( SELECT string_agg((t.label || ' '::text) || replace(t.slug, '-'::text, ' '::text), ' '::text ORDER BY t.term_key) AS string_agg
                   FROM company_profile_travel_terms pt
                     JOIN travel_terms t USING (term_key)
                  WHERE pt.profile_id = p.id AND NOT p.demo), ''::text) AS terms,
            concat_ws(' '::text,
                CASE
                    WHEN NOT p.demo THEN p.tagline
                    ELSE NULL::text
                END,
                CASE
                    WHEN COALESCE(about.content ->> 'hidden'::text, 'false'::text) <> 'true'::text AND NOT COALESCE(about.content -> 'deleted_sections'::text, '[]'::jsonb) ? 'section:about'::text AND COALESCE(about.content ->> 'heading_hidden'::text, 'false'::text) <> 'true'::text AND (about.id IS NOT NULL OR NOT p.demo AND NULLIF(p.description, ''::text) IS NOT NULL) THEN COALESCE(about.content ->> 'text'::text, 'Über '::text ||
                    CASE
                        WHEN p.demo THEN 'Demo GmbH'::text
                        ELSE p.display_name
                    END)
                    ELSE NULL::text
                END,
                CASE
                    WHEN COALESCE(business.content ->> 'hidden'::text, 'false'::text) <> 'true'::text AND NOT COALESCE(about.content -> 'deleted_sections'::text, '[]'::jsonb) ? 'section:business'::text AND COALESCE(business.content ->> 'heading_hidden'::text, 'false'::text) <> 'true'::text AND (business.id IS NOT NULL OR NOT p.demo AND NULLIF(p.business_areas, ''::text) IS NOT NULL) THEN COALESCE(business.content ->> 'text'::text, 'Tätigkeitsbereiche'::text)
                    ELSE NULL::text
                END, ( SELECT string_agg(b.content ->> 'text'::text, ' '::text ORDER BY b.sort_order, b.id) AS string_agg
                   FROM profile_content_blocks b
                  WHERE b.profile_id = p.id AND NOT p.demo AND b.slot IS NULL AND b.type = 'heading'::text AND NOT COALESCE(about.content -> 'hidden_blocks'::text, '[]'::jsonb) ? b.id::text)) AS headings,
            concat_ws(' '::text,
                CASE
                    WHEN NOT p.demo AND COALESCE(about.content ->> 'hidden'::text, 'false'::text) <> 'true'::text AND NOT COALESCE(about.content -> 'deleted_sections'::text, '[]'::jsonb) ? 'section:about'::text THEN p.description
                    ELSE NULL::text
                END,
                CASE
                    WHEN NOT p.demo AND COALESCE(business.content ->> 'hidden'::text, 'false'::text) <> 'true'::text AND NOT COALESCE(about.content -> 'deleted_sections'::text, '[]'::jsonb) ? 'section:business'::text THEN p.business_areas
                    ELSE NULL::text
                END, p.phone,
                CASE
                    WHEN NOT p.demo OR COALESCE(p.public_email, ''::text) !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung'::text THEN p.public_email
                    ELSE NULL::text
                END,
                CASE
                    WHEN NOT p.demo OR COALESCE(p.website, ''::text) !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung'::text THEN p.website
                    ELSE NULL::text
                END, ( SELECT string_agg(b.content ->> 'text'::text, ' '::text ORDER BY b.sort_order, b.id) AS string_agg
                   FROM profile_content_blocks b
                  WHERE b.profile_id = p.id AND NOT p.demo AND b.slot IS NULL AND b.type = 'text'::text AND NOT COALESCE(about.content -> 'hidden_blocks'::text, '[]'::jsonb) ? b.id::text), ( SELECT string_agg(i.caption, ' '::text ORDER BY i.sort_order, i.id) AS string_agg
                   FROM profile_content_block_images i
                     JOIN profile_content_blocks b ON b.id = i.block_id
                  WHERE b.profile_id = p.id AND NOT p.demo AND b.type = 'image_grid'::text AND NOT COALESCE(about.content -> 'hidden_blocks'::text, '[]'::jsonb) ? b.id::text AND i.storage_path ~~ (('profiles/'::text || p.id::text) || '/blocks/%'::text) AND (EXISTS ( SELECT 1
                           FROM storage.objects o
                          WHERE o.bucket_id = 'company-media'::text AND o.name = i.storage_path)) AND NOT (EXISTS ( SELECT 1
                           FROM profile_content_blocks s
                          WHERE s.profile_id = p.id AND s.slot IS NOT NULL AND (s.content ->> 'adjacent_image_id'::text) = b.id::text AND ((s.content ->> 'hidden'::text) = 'true'::text OR COALESCE(about.content -> 'deleted_sections'::text, '[]'::jsonb) ?
                                CASE
                                    WHEN s.slot = 'about_heading'::text THEN 'section:about'::text
                                    ELSE 'section:business'::text
                                END))))) AS body
           FROM profiles p
             LEFT JOIN profile_content_blocks about ON about.profile_id = p.id AND NOT p.demo AND about.slot = 'about_heading'::text
             LEFT JOIN profile_content_blocks business ON business.profile_id = p.id AND NOT p.demo AND business.slot = 'business_areas_heading'::text
        )
 SELECT id,
    url,
    title,
    location,
    terms,
    headings,
    body,
    ((setweight(portal_search_vector(title), 'A'::"char") || setweight(portal_search_vector((location || ' '::text) || terms), 'B'::"char")) || setweight(portal_search_vector(headings), 'C'::"char")) || setweight(portal_search_vector(body), 'D'::"char") AS document
   FROM documents;
COMMENT ON TABLE public.company_profile_public_visibility IS 'Public presentation only; absent row means listed. Approved profile API access and banner delivery stay unchanged.';

