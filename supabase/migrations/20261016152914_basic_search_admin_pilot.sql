-- REVIEW PROPOSAL ONLY. No Cloud application or seed is authorized by this file.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';

-- Safe physical projection; technical columns are never returned to the browser.
ALTER TABLE public.basic_accommodation_contacts
 ADD COLUMN filter_keys text[] NOT NULL DEFAULT '{}',
 ADD COLUMN accommodation_type text,
 ADD COLUMN rights_valid_until timestamptz,
 ADD COLUMN name_key text GENERATED ALWAYS AS(public.portal_search_normalize(name::text)) STORED,
 ADD COLUMN city_key text GENERATED ALWAYS AS(public.portal_search_normalize(address->>'city')) STORED,
 ADD COLUMN normalized_vector tsvector GENERATED ALWAYS AS(public.portal_search_vector(name::text||' '||(address->>'city')||' '||(address->>'region')||' '||
  CASE address->>'country' WHEN 'DE' THEN 'Deutschland' WHEN 'AT' THEN 'Österreich' WHEN 'CH' THEN 'Schweiz' ELSE 'Italien Südtirol' END||' '||
  coalesce(address->>'postalCode','')||' '||coalesce(address->>'street','')||' '||coalesce(address->>'houseNumber',''))) STORED;
CREATE INDEX basic_contacts_normalized_search_idx ON public.basic_accommodation_contacts USING gin(normalized_vector) WHERE is_listed;
CREATE INDEX basic_contacts_filter_idx ON public.basic_accommodation_contacts USING gin(filter_keys) WHERE is_listed;
CREATE INDEX basic_contacts_keyset_idx ON public.basic_accommodation_contacts(name_key COLLATE pg_catalog."C",id) WHERE is_listed;
CREATE INDEX basic_contacts_city_idx ON public.basic_accommodation_contacts(city_key COLLATE pg_catalog."C",name_key COLLATE pg_catalog."C",id) WHERE is_listed;

-- Keep filter predicates inline. A SQL helper with SET search_path is not
-- inlined by PostgreSQL and imposed per-row function/config overhead at scale.
-- Fixed, bounded output. This function reads only public profile documents and
-- the physical Basic contact projection, never acquisition CRM rows.
-- Definer is needed only because technical projection columns have no API grants.
CREATE FUNCTION public.search_public_accommodations(p_query text DEFAULT '',p_filters jsonb DEFAULT '{}',
 p_cursor jsonb DEFAULT NULL,p_limit integer DEFAULT 20,p_count_only boolean DEFAULT false,p_facets boolean DEFAULT false,p_basics_only boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; scope text; q text:=left(btrim(coalesce(p_query,'')),160);
 filters jsonb:=coalesce(p_filters,'{}'); ordering text:=coalesce(p_filters->>'sort','');
BEGIN
 IF jsonb_typeof(filters)<>'object' OR octet_length(filters::text)>2048 OR p_limit NOT BETWEEN 1 AND 20
  OR filters-ARRAY['destination','theme','audience','accommodation','location','sort']<>'{}'
  OR EXISTS(SELECT FROM jsonb_each(filters)e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>120)
  OR coalesce(filters->>'location','')<>'' THEN RAISE EXCEPTION 'invalid search filters' USING ERRCODE='22023'; END IF;
 IF ordering NOT IN('','name','city','imported') THEN RAISE EXCEPTION 'invalid sort' USING ERRCODE='22023'; END IF;
 scope:=md5(q||filters::text||p_basics_only::text);
 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR octet_length(p_cursor::text)>2048
  OR p_cursor->>'scope' IS DISTINCT FROM scope OR NOT(p_cursor ?& ARRAY['tier','order','text','name','id'])
  OR (p_cursor->>'tier') !~ '^[012]$' OR (p_cursor->>'id') !~ '^[a-f0-9-]{36}$') THEN
  RAISE EXCEPTION 'invalid or mismatched search cursor' USING ERRCODE='22023'; END IF;
 WITH query AS(SELECT public.portal_search_query(q) tsq,public.portal_search_normalize(q) normalized),
 -- Preserve existing public visibility, demo and editorial document semantics.
 profile_rows AS MATERIALIZED(
  SELECT p.id,d.title,d.url,coalesce(p.city,'') city,
  CASE p.country WHEN 'Deutschland' THEN 'DE' WHEN 'Germany' THEN 'DE' WHEN 'Österreich' THEN 'AT'
   WHEN 'Austria' THEN 'AT' WHEN 'Schweiz' THEN 'CH' WHEN 'Switzerland' THEN 'CH' WHEN 'Italien' THEN 'IT'
   WHEN 'Italy' THEN 'IT' ELSE p.country END country,
  coalesce((SELECT array_agg(t.term_key ORDER BY t.term_key) FROM public.company_profile_travel_terms t WHERE t.profile_id=p.id),'{}') keys,
  CASE WHEN q='' THEN 0::real ELSE
   (CASE WHEN public.portal_search_normalize(d.title)=x.normalized THEN 1000 WHEN public.portal_search_normalize(d.title) LIKE x.normalized||'%' THEN 800
    WHEN public.portal_search_vector(d.title)@@x.tsq THEN 600 WHEN public.portal_search_vector(d.location)@@x.tsq THEN 400
    WHEN public.portal_search_vector(d.terms)@@x.tsq THEN 300 WHEN public.portal_search_vector(d.headings)@@x.tsq THEN 200 ELSE 100 END
    +ts_rank_cd(d.document,x.tsq,32)) END rank,
  CASE WHEN q='' THEN '' ELSE left(concat_ws(' ',d.headings,d.body,d.location),1000) END excerpt,
  CASE WHEN pack.package='premium' THEN 0 ELSE 1 END tier,coalesce(ord.sort_order,2147483647) directory_order,
  coalesce(extract(epoch FROM imported.imported_at),0)::numeric imported_order
  FROM public.company_profiles p JOIN public.portal_search_documents d ON d.id=p.id
  LEFT JOIN public.company_profile_directory_packages pack ON pack.profile_id=p.id
  LEFT JOIN public.company_directory_order ord ON ord.profile_id=p.id AND ord.demo_slug IS NULL
  LEFT JOIN public.company_profile_imports imported ON imported.profile_id=p.id
  CROSS JOIN query x WHERE NOT p_basics_only AND(q='' OR numnode(x.tsq)>0 AND d.document@@x.tsq)
 ), candidates AS NOT MATERIALIZED(
  SELECT p.id,p.tier,p.title,p.city,p.country,p.keys,p.rank,p.excerpt,p.url,p.directory_order,p.imported_order,
   public.portal_search_normalize(p.title) name_key,public.portal_search_normalize(p.city) city_key FROM profile_rows p
  UNION ALL
  SELECT b.id,2,b.name,b.address->>'city',b.address->>'country',
   b.filter_keys||coalesce(ARRAY[b.accommodation_type],'{}'),0::real,''::text,NULL::text,
   2147483647,0::numeric,b.name_key,b.city_key
  FROM public.basic_accommodation_contacts b CROSS JOIN query x
  WHERE b.is_listed AND(b.rights_valid_until IS NULL OR b.rights_valid_until>statement_timestamp()) AND(q='' OR numnode(x.tsq)>0 AND
   b.normalized_vector@@x.tsq)
 ), matched AS NOT MATERIALIZED(
  SELECT c.*,
   CASE WHEN ordering='city' THEN c.city_key ELSE '' END text_key,
   CASE WHEN ordering IN('name','city') THEN 0::numeric WHEN ordering='imported' THEN -c.imported_order WHEN q='' THEN c.directory_order::numeric ELSE -c.rank::numeric END order_key
  FROM candidates c WHERE ((coalesce(filters->>'destination','')='' OR c.country=CASE filters->>'destination' WHEN 'deutschland' THEN 'DE' WHEN 'oesterreich' THEN 'AT' WHEN 'schweiz' THEN 'CH' WHEN 'suedtirol-italien' THEN 'IT' ELSE '?' END) AND (coalesce(filters->>'theme','')='' OR ('theme:'||(filters->>'theme'))=ANY(c.keys)) AND (coalesce(filters->>'audience','')='' OR ('audience:'||(filters->>'audience'))=ANY(c.keys)) AND (coalesce(filters->>'accommodation','')='' OR ('accommodation:'||(filters->>'accommodation'))=ANY(c.keys)))
 ), page AS MATERIALIZED(
  SELECT * FROM matched m WHERE NOT p_count_only AND(p_cursor IS NULL OR
   (m.tier,m.order_key,m.text_key COLLATE pg_catalog."C",m.name_key COLLATE pg_catalog."C",m.id)>
   ((p_cursor->>'tier')::int,(p_cursor->>'order')::numeric,(p_cursor->>'text') COLLATE pg_catalog."C",(p_cursor->>'name') COLLATE pg_catalog."C",(p_cursor->>'id')::uuid))
  ORDER BY tier,order_key,text_key COLLATE pg_catalog."C",name_key COLLATE pg_catalog."C",id LIMIT p_limit+1
 ), numbered AS(SELECT *,row_number() OVER(ORDER BY tier,order_key,text_key COLLATE pg_catalog."C",name_key COLLATE pg_catalog."C",id) n FROM page),
 facet_rows AS(
  SELECT 'destination' dimension,CASE country WHEN 'DE' THEN 'deutschland' WHEN 'AT' THEN 'oesterreich' WHEN 'CH' THEN 'schweiz' WHEN 'IT' THEN 'suedtirol-italien' END slug,count(*) amount
  FROM candidates WHERE p_facets AND ((coalesce(filters->>'theme','')='' OR ('theme:'||(filters->>'theme'))=ANY(keys)) AND (coalesce(filters->>'audience','')='' OR ('audience:'||(filters->>'audience'))=ANY(keys)) AND (coalesce(filters->>'accommodation','')='' OR ('accommodation:'||(filters->>'accommodation'))=ANY(keys))) GROUP BY country
  UNION ALL
  SELECT split_part(k,':',1),split_part(k,':',2),count(*)
  FROM candidates c CROSS JOIN LATERAL unnest(c.keys) k
  WHERE p_facets AND split_part(k,':',1) IN('theme','audience','accommodation')
   AND ((split_part(k,':',1)='destination' OR coalesce(filters->>'destination','')='' OR c.country=CASE filters->>'destination' WHEN 'deutschland' THEN 'DE' WHEN 'oesterreich' THEN 'AT' WHEN 'schweiz' THEN 'CH' WHEN 'suedtirol-italien' THEN 'IT' ELSE '?' END) AND (split_part(k,':',1)='theme' OR coalesce(filters->>'theme','')='' OR ('theme:'||(filters->>'theme'))=ANY(c.keys)) AND (split_part(k,':',1)='audience' OR coalesce(filters->>'audience','')='' OR ('audience:'||(filters->>'audience'))=ANY(c.keys)) AND (split_part(k,':',1)='accommodation' OR coalesce(filters->>'accommodation','')='' OR ('accommodation:'||(filters->>'accommodation'))=ANY(c.keys))) GROUP BY k
 )
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matched),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('entry',
   CASE WHEN tier=2 THEN(SELECT jsonb_build_object('kind','basic','id',b.id,'name',b.name,'address',b.address,'phone',b.phone)
    FROM public.basic_accommodation_contacts b WHERE b.id=numbered.id) ELSE jsonb_build_object('kind','profile','id',id,'title',title,'url',url,'rank',rank,'excerpt',excerpt) END,
   'after',jsonb_build_object('scope',scope,'tier',tier,'order',order_key,'text',text_key,'name',name_key,'id',id)) ORDER BY n)
   FROM numbered WHERE n<=p_limit),'[]'),
  'hasMore',EXISTS(SELECT FROM numbered WHERE n>p_limit),
  'facets',coalesce((SELECT jsonb_object_agg(dimension||':'||slug,amount) FROM facet_rows WHERE slug IS NOT NULL),'{}'))
 INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.search_public_accommodations(text,jsonb,jsonb,integer,boolean,boolean,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.search_public_accommodations(text,jsonb,jsonb,integer,boolean,boolean,boolean) TO anon,authenticated;

-- Narrow existing-Admin entry points; no private-schema/table grants.
CREATE FUNCTION public.admin_basic_accommodations(p_query text DEFAULT '',p_after jsonb DEFAULT NULL) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
 IF length(coalesce(p_query,''))>200 OR(p_after IS NOT NULL AND (jsonb_typeof(p_after)<>'object' OR octet_length(p_after::text)>1024
  OR p_after->>'query' IS DISTINCT FROM coalesce(p_query,''))) THEN RAISE EXCEPTION 'invalid admin cursor' USING ERRCODE='22023'; END IF;
 WITH matched AS MATERIALIZED(
  SELECT a.id,a.name,a.city,a.country,a.visibility_status,a.revision,public.portal_search_normalize(a.name::text) key
  FROM acquisition.accommodations a WHERE a.canonical_accommodation_id IS NULL
  AND(coalesce(p_query,'')='' OR public.portal_search_vector(concat_ws(' ',a.name,a.city))@@public.portal_search_query(p_query))
 ), page AS(
  SELECT * FROM matched WHERE p_after IS NULL OR(key COLLATE pg_catalog."C",id)>((p_after->>'key') COLLATE pg_catalog."C",(p_after->>'id')::uuid)
  ORDER BY key COLLATE pg_catalog."C",id LIMIT 21
 ), numbered AS(SELECT *,row_number()OVER(ORDER BY key COLLATE pg_catalog."C",id)n FROM page)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM matched),'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',id,'name',name,'city',city,'country',country,'visibility',visibility_status,'revision',revision) ORDER BY n) FROM numbered WHERE n<=20),'[]'),
  'nextCursor',(SELECT jsonb_build_object('query',coalesce(p_query,''),'key',key,'id',id) FROM numbered WHERE n=20 AND EXISTS(SELECT FROM numbered WHERE n=21))) INTO result;
 RETURN result;
END;
$$;
CREATE FUNCTION public.admin_basic_categories(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT acquisition.read_basic_categories(p_id);
$$;
CREATE FUNCTION public.save_admin_basic_categories(p_id uuid,p_revision bigint,p_selected text[],p_reason text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT acquisition.save_basic_categories(p_id,p_revision,p_selected,p_reason);
$$;
REVOKE ALL ON FUNCTION public.admin_basic_accommodations(text,jsonb),public.admin_basic_categories(uuid),
 public.save_admin_basic_categories(uuid,bigint,text[],text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_basic_accommodations(text,jsonb),public.admin_basic_categories(uuid),
 public.save_admin_basic_categories(uuid,bigint,text[],text) TO authenticated;

-- Maintain only technical search metadata for an already published contact.
-- A category update never makes a private/withdrawn accommodation public.
CREATE FUNCTION acquisition.sync_basic_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.basic_accommodation_contacts SET filter_keys=NEW.effective_theme_keys,accommodation_type=NEW.accommodation_type,
  is_listed=is_listed AND NEW.existing_profile_id IS NULL AND NOT NEW.had_profile_link AND NEW.publication_block IS NULL
   AND NEW.visibility_status='public' AND NEW.approval_status='approved' AND NEW.identity_status='clear'
   AND NEW.activity_status IN('active','seasonal') AND NEW.contact_status='checked' AND NEW.eligibility_status='eligible'
   AND cardinality(NEW.effective_theme_keys)>0
 WHERE id=NEW.id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER sync_basic_contact AFTER UPDATE ON acquisition.accommodations FOR EACH ROW EXECUTE FUNCTION acquisition.sync_basic_contact();
REVOKE ALL ON FUNCTION acquisition.sync_basic_contact() FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;
-- Publication barriers deliberately remain until a separate, concrete reviewed
-- pilot-import/publication transaction is approved. No seed, publisher or job.
COMMIT;

