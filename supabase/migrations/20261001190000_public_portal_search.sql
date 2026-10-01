BEGIN;

-- Live projections, not a second copy of editorial content. No existing grants,
-- policies, booking targets or source rows are changed.
CREATE FUNCTION public.portal_search_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER SET search_path='' AS $$
 SELECT btrim(regexp_replace(replace(replace(replace(replace(replace(replace(replace(
   lower(value),'ä','a'),'ö','o'),'ü','u'),'ß','ss'),'ae','a'),'oe','o'),'ue','u'), '[^[:alnum:]]+', ' ', 'g'));
$$;
CREATE FUNCTION public.portal_search_vector(value text) RETURNS tsvector
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER SET search_path='' AS $$
 SELECT to_tsvector('pg_catalog.german', public.portal_search_normalize(value));
$$;
CREATE FUNCTION public.portal_search_query(value text) RETURNS tsquery
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SECURITY INVOKER SET search_path='' AS $$
 SELECT coalesce(to_tsquery('pg_catalog.german',string_agg(quote_literal(word) || ':*',' & ')), ''::tsquery)
 FROM unnest(tsvector_to_array(public.portal_search_vector(left(btrim(value),160)))) word;
$$;

-- Useful row-level GIN indexes. Aggregated taxonomy/CMS documents are evaluated
-- live; their visibility cannot safely be materialized in an independently stale index.
CREATE INDEX company_profiles_portal_search_gin ON public.company_profiles USING gin
 (public.portal_search_vector(coalesce(display_name,'') || ' ' || coalesce(tagline,'') || ' ' ||
 coalesce(description,'') || ' ' || coalesce(business_areas,'') || ' ' || coalesce(city,'') || ' ' ||
 coalesce(region,'') || ' ' || coalesce(country,''))) WHERE status='approved';
CREATE INDEX profile_content_portal_search_gin ON public.profile_content_blocks USING gin
 (public.portal_search_vector(coalesce(content->>'text',''))) WHERE slot IS NULL AND type IN ('heading','text');

CREATE VIEW public.portal_search_documents WITH (security_invoker=true,security_barrier=true) AS
 WITH profiles AS (
 SELECT p.id,p.slug,p.display_name,p.tagline,p.description,p.business_areas,p.city,p.region,p.country,
 p.street,p.postal_code,p.phone,p.public_email,p.website,
 p.id='31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid AND p.slug='energieheld-demo-gmbh-c3351d59' AS demo
 FROM public.company_profiles p WHERE p.status='approved' AND (
 (p.id='31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid AND p.slug='energieheld-demo-gmbh-c3351d59') OR
 (p.slug<>'energieheld-demo-gmbh-c3351d59' AND NOT EXISTS (
 SELECT 1 FROM public.company_profile_categories pc WHERE pc.profile_id=p.id) AND
 coalesce(p.display_name,'') || ' ' || coalesce(p.tagline,'') || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.business_areas,'')
 !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung'))
 ), documents AS (
 SELECT p.id,
 CASE WHEN p.demo THEN '/unterkuenfte/demo-gmbh' ELSE '/unterkuenfte/' || p.slug END AS url,
 CASE WHEN p.demo THEN 'Demo GmbH' ELSE p.display_name END AS title,
 concat_ws(' ',p.city,p.postal_code,CASE WHEN p.region='Bayern' AND p.country IS NOT NULL AND p.country<>'Deutschland' THEN '' ELSE p.region END,p.country,p.street) AS location,
 coalesce((SELECT string_agg(t.label || ' ' || replace(t.slug,'-',' '),' ' ORDER BY t.term_key) FROM public.company_profile_travel_terms pt JOIN public.travel_terms t USING(term_key) WHERE pt.profile_id=p.id AND NOT p.demo),'') AS terms,
 concat_ws(' ',CASE WHEN NOT p.demo THEN p.tagline END,
 CASE WHEN coalesce(about.content->>'hidden','false')<>'true' AND NOT coalesce(about.content->'deleted_sections','[]'::jsonb) ? 'section:about'
 AND coalesce(about.content->>'heading_hidden','false')<>'true' AND (about.id IS NOT NULL OR NOT p.demo AND nullif(p.description,'') IS NOT NULL) THEN coalesce(about.content->>'text','Über ' || CASE WHEN p.demo THEN 'Demo GmbH' ELSE p.display_name END) END,
 CASE WHEN coalesce(business.content->>'hidden','false')<>'true' AND NOT coalesce(about.content->'deleted_sections','[]'::jsonb) ? 'section:business'
 AND coalesce(business.content->>'heading_hidden','false')<>'true' AND (business.id IS NOT NULL OR NOT p.demo AND nullif(p.business_areas,'') IS NOT NULL) THEN coalesce(business.content->>'text','Tätigkeitsbereiche') END,
 (SELECT string_agg(b.content->>'text',' ' ORDER BY b.sort_order,b.id) FROM public.profile_content_blocks b WHERE b.profile_id=p.id AND NOT p.demo AND b.slot IS NULL AND b.type='heading'
 AND NOT coalesce(about.content->'hidden_blocks','[]'::jsonb) ? b.id::text)) AS headings,
 concat_ws(' ',CASE WHEN NOT p.demo AND coalesce(about.content->>'hidden','false')<>'true' AND NOT coalesce(about.content->'deleted_sections','[]'::jsonb) ? 'section:about' THEN p.description END,
 CASE WHEN NOT p.demo AND coalesce(business.content->>'hidden','false')<>'true' AND NOT coalesce(about.content->'deleted_sections','[]'::jsonb) ? 'section:business' THEN p.business_areas END,
 p.phone,CASE WHEN NOT p.demo OR coalesce(p.public_email,'') !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung' THEN p.public_email END,
 CASE WHEN NOT p.demo OR coalesce(p.website,'') !~* 'energieheld|energieberatung|photovoltaik|heizung|dämmung|dachsanierung|smart home|fachbetrieb|sanierung' THEN p.website END,
 (SELECT string_agg(b.content->>'text',' ' ORDER BY b.sort_order,b.id) FROM public.profile_content_blocks b WHERE b.profile_id=p.id AND NOT p.demo AND b.slot IS NULL AND b.type='text'
 AND NOT coalesce(about.content->'hidden_blocks','[]'::jsonb) ? b.id::text),
 (SELECT string_agg(i.caption,' ' ORDER BY i.sort_order,i.id) FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id
 WHERE b.profile_id=p.id AND NOT p.demo AND b.type='image_grid' AND NOT coalesce(about.content->'hidden_blocks','[]'::jsonb) ? b.id::text
 AND i.storage_path LIKE 'profiles/' || p.id::text || '/blocks/%'
 AND EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='company-media' AND o.name=i.storage_path)
 AND NOT EXISTS (SELECT 1 FROM public.profile_content_blocks s WHERE s.profile_id=p.id AND s.slot IS NOT NULL AND s.content->>'adjacent_image_id'=b.id::text
 AND (s.content->>'hidden'='true' OR coalesce(about.content->'deleted_sections','[]'::jsonb) ? CASE WHEN s.slot='about_heading' THEN 'section:about' ELSE 'section:business' END)))) AS body
 FROM profiles p LEFT JOIN public.profile_content_blocks about ON about.profile_id=p.id AND NOT p.demo AND about.slot='about_heading'
 LEFT JOIN public.profile_content_blocks business ON business.profile_id=p.id AND NOT p.demo AND business.slot='business_areas_heading'
 ) SELECT *, setweight(public.portal_search_vector(title),'A') || setweight(public.portal_search_vector(location || ' ' || terms),'B') ||
 setweight(public.portal_search_vector(headings),'C') || setweight(public.portal_search_vector(body),'D') AS document FROM documents;
REVOKE ALL ON public.portal_search_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.portal_search_documents TO anon,authenticated;

-- One network call: ranked profile hits plus the safe existing public ad
-- projection and presentation settings for all currently supported pages.
CREATE FUNCTION public.search_public_portal(p_query text,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0,p_areas text[] DEFAULT '{}'::text[],p_catalog jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH query AS (SELECT public.portal_search_query(coalesce(p_query,'')) AS tsq,public.portal_search_normalize(left(btrim(coalesce(p_query,'')),160)) AS normalized),
 catalog AS (SELECT left(item->>'id',2048) AS id,item->>'type' AS type,left(item->>'title',300) AS title,
 left(item->>'body',10000) AS body,left(item->>'url',2048) AS url,left(item->>'context',160) AS context
 FROM (SELECT value AS item FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_catalog)='array' THEN p_catalog ELSE '[]'::jsonb END) LIMIT 256) input
 WHERE item->>'type' IN ('page','theme','destination','ad') AND jsonb_typeof(item)='object'),
 catalog_matches AS (SELECT c.id,c.type,c.title,c.url,c.context,
 ts_headline('pg_catalog.german',coalesce(c.body,''),q.tsq,'StartSel=,StopSel=,MaxWords=40,MinWords=15,MaxFragments=1') AS excerpt,
 CASE WHEN public.portal_search_normalize(c.title)=q.normalized THEN 1000 WHEN public.portal_search_normalize(c.title) LIKE q.normalized || '%' THEN 800
 WHEN public.portal_search_vector(c.title) @@ q.tsq THEN 600 ELSE 100 END +
 ts_rank_cd(setweight(public.portal_search_vector(coalesce(c.title,'')),'A') || setweight(public.portal_search_vector(coalesce(c.body,'')),'D'),q.tsq,32) AS rank
 FROM catalog c CROSS JOIN query q WHERE numnode(q.tsq)>0 AND public.portal_search_vector(concat_ws(' ',c.title,c.body)) @@ q.tsq),
 candidate_query AS (SELECT to_tsquery('pg_catalog.german',replace(tsq::text,' & ',' | ')) AS tsq FROM query),
 candidates AS (
 SELECT p.id FROM public.company_profiles p CROSS JOIN candidate_query q WHERE p.status='approved' AND public.portal_search_vector(
 coalesce(p.display_name,'') || ' ' || coalesce(p.tagline,'') || ' ' || coalesce(p.description,'') || ' ' || coalesce(p.business_areas,'') || ' ' ||
 coalesce(p.city,'') || ' ' || coalesce(p.region,'') || ' ' || coalesce(p.country,'')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_blocks b CROSS JOIN candidate_query q WHERE b.slot IS NULL AND b.type IN ('heading','text') AND public.portal_search_vector(coalesce(b.content->>'text','')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_blocks b CROSS JOIN candidate_query q WHERE b.slot IS NOT NULL AND public.portal_search_vector(coalesce(b.content->>'text','')) @@ q.tsq
 UNION SELECT b.profile_id FROM public.profile_content_block_images i JOIN public.profile_content_blocks b ON b.id=i.block_id CROSS JOIN candidate_query q WHERE public.portal_search_vector(coalesce(i.caption,'')) @@ q.tsq
 UNION SELECT pt.profile_id FROM public.company_profile_travel_terms pt JOIN public.travel_terms t USING(term_key) CROSS JOIN candidate_query q WHERE public.portal_search_vector(t.label || ' ' || replace(t.slug,'-',' ')) @@ q.tsq
 UNION SELECT p.id FROM public.company_profiles p CROSS JOIN candidate_query q WHERE p.status='approved' AND public.portal_search_vector(concat_ws(' ',p.street,p.postal_code,p.phone,p.public_email,p.website)) @@ q.tsq
 UNION SELECT '31ae7d1e-26a7-4161-8d14-f5ee4735f5d4'::uuid FROM candidate_query q WHERE public.portal_search_vector('Demo GmbH') @@ q.tsq
 ),
 matches AS (SELECT d.id,d.url,d.title,
 ts_headline('pg_catalog.german',concat_ws(' ',d.headings,d.body,d.location,d.terms),q.tsq,'StartSel=,StopSel=,MaxWords=40,MinWords=15,MaxFragments=1') AS excerpt,
 (CASE WHEN public.portal_search_normalize(d.title)=q.normalized THEN 1000 WHEN public.portal_search_normalize(d.title) LIKE q.normalized || '%' THEN 800
 WHEN public.portal_search_vector(d.title) @@ q.tsq THEN 600 WHEN public.portal_search_vector(d.location) @@ q.tsq THEN 400
 WHEN public.portal_search_vector(d.terms) @@ q.tsq THEN 300 WHEN public.portal_search_vector(d.headings) @@ q.tsq THEN 200 ELSE 100 END
 + ts_rank_cd(d.document,q.tsq,32)) AS rank FROM public.portal_search_documents d JOIN candidates c ON c.id=d.id CROSS JOIN query q WHERE numnode(q.tsq)>0 AND d.document @@ q.tsq),
 contexts AS (SELECT 'homepage'::text AS scope,NULL::text AS key,'/'::text AS path UNION ALL SELECT 'experts_directory',NULL,'/unterkuenfte-a-z'
 UNION ALL SELECT 'portal_area',area,'/' || area FROM (SELECT DISTINCT unnest(CASE WHEN array_ndims(p_areas)=1 THEN p_areas[1:64] ELSE '{}'::text[] END) AS area) a WHERE char_length(area)<=160 AND area ~ '^(mottoreisen|reiseziele)(/[a-z0-9-]+)?$'),
 ads AS (SELECT c.path,a.id,a.placement,a.headline,a.body_text,a.target_url,a.image_path,
 a.image_path IS NULL OR EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='ad-media' AND o.name=a.image_path) AS image_available,
 CASE WHEN public.portal_search_vector(concat_ws(' ',a.headline,a.body_text)) @@ q.tsq THEN
 CASE WHEN public.portal_search_normalize(a.headline)=q.normalized THEN 1000 WHEN public.portal_search_vector(a.headline) @@ q.tsq THEN 600 ELSE 100 END
 + ts_rank_cd(setweight(public.portal_search_vector(a.headline),'A') || setweight(public.portal_search_vector(coalesce(a.body_text,'')),'D'),q.tsq,32) ELSE 0 END AS rank
 FROM contexts c CROSS JOIN LATERAL public.get_active_ad_campaigns(c.scope,c.key) a CROSS JOIN query q),
 settings AS (SELECT c.path,s.placement,s.size,s.legacy_hidden,s.legacy_target_url,s.legacy_placement,s.display_source FROM contexts c JOIN public.ad_slot_presentations s
 ON s.target_type=c.scope AND s.target_key IS NOT DISTINCT FROM c.key)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matches),'hits',coalesce((SELECT jsonb_agg(row_to_json(h)) FROM (
 SELECT * FROM matches ORDER BY rank DESC,title,id LIMIT greatest(1,least(coalesce(p_limit,100),1000)) OFFSET greatest(0,least(coalesce(p_offset,0),10000))) h),'[]'::jsonb),
 'catalog_hits',coalesce((SELECT jsonb_agg(row_to_json(c) ORDER BY c.rank DESC,c.title,c.id) FROM catalog_matches c),'[]'::jsonb),
 'ads',coalesce((SELECT jsonb_agg(row_to_json(a)) FROM ads a),'[]'::jsonb),'presentations',coalesce((SELECT jsonb_agg(row_to_json(s)) FROM settings s),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.portal_search_normalize(text),public.portal_search_vector(text),public.portal_search_query(text),public.search_public_portal(text,integer,integer,text[],jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_search_normalize(text),public.portal_search_vector(text),public.portal_search_query(text),public.search_public_portal(text,integer,integer,text[],jsonb) TO anon,authenticated;

COMMIT;
