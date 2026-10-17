-- LOCAL REVIEW ONLY. No seed, source grants, publication or worker activation.
BEGIN;
SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='15s';
CREATE INDEX observation_latest_assessment_idx ON acquisition.observations(accommodation_id,created_at DESC,id)
 WHERE fact_type='correction' AND facts->>'kind'='pipeline_assessment';

CREATE FUNCTION acquisition.latest_basic_assessment(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT o.facts FROM acquisition.observations o WHERE o.accommodation_id=p_id AND o.fact_type='correction'
 AND o.facts->>'kind'='pipeline_assessment' AND o.facts->>'ruleVersion' IN('private-e2e-assessment-v2','private-e2e-assessment-v3')
 ORDER BY o.created_at DESC,o.id DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION acquisition.latest_basic_assessment(uuid) FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;

CREATE FUNCTION public.admin_basic_assessment_page(p_query text DEFAULT '',p_after jsonb DEFAULT NULL,p_price_group text DEFAULT '',p_filter jsonb DEFAULT '{}') RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; k text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF p_query IS NULL OR length(p_query)>200 OR p_price_group IS NULL OR p_price_group NOT IN('','A','B','C','D')
 OR p_filter IS NULL OR jsonb_typeof(p_filter)<>'object' OR octet_length(p_filter::text)>1024
 OR (p_after IS NOT NULL AND (jsonb_typeof(p_after)<>'object' OR octet_length(p_after::text)>2048 OR p_after->>'query' IS DISTINCT FROM p_query OR p_after->>'priceGroup' IS DISTINCT FROM p_price_group OR coalesce(p_after->'filter','{}') IS DISTINCT FROM p_filter)) THEN RAISE EXCEPTION 'invalid assessment filter/cursor' USING ERRCODE='22023';END IF;
 FOR k IN SELECT jsonb_object_keys(p_filter) LOOP
  IF k NOT IN('importRun','sourceId','ruleVersion') OR jsonb_typeof(p_filter->k)<>'string' OR
   (k IN('importRun','sourceId') AND (p_filter->>k)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') OR
   (k='ruleVersion' AND length(btrim(p_filter->>k)) NOT BETWEEN 1 AND 100) THEN RAISE EXCEPTION 'invalid assessment filter/cursor' USING ERRCODE='22023';END IF;
 END LOOP;
 WITH matched AS MATERIALIZED(
  SELECT a.id,a.name,a.city,a.country,a.visibility_status,a.revision,public.portal_search_normalize(a.name::text) key,
   coalesce(acquisition.latest_basic_assessment(a.id)->>'priceGroup','C') price_group
  FROM acquisition.accommodations a WHERE a.canonical_accommodation_id IS NULL
   AND(p_query='' OR public.portal_search_vector(concat_ws(' ',a.name,a.city))@@public.portal_search_query(p_query))
   AND(NOT p_filter?'importRun' OR a.last_import_run_id=(p_filter->>'importRun')::uuid)
   AND(NOT p_filter?'sourceId' OR EXISTS(SELECT FROM acquisition.observations o WHERE o.id=a.primary_observation_id AND o.source_id=(p_filter->>'sourceId')::uuid))
   AND(NOT p_filter?'ruleVersion' OR acquisition.latest_basic_assessment(a.id)->>'ruleVersion'=p_filter->>'ruleVersion' OR acquisition.latest_basic_assessment(a.id)->>'priceRuleVersion'=p_filter->>'ruleVersion')
 ), filtered AS MATERIALIZED(SELECT * FROM matched WHERE p_price_group='' OR price_group=p_price_group), page AS(
  SELECT * FROM filtered WHERE p_after IS NULL OR(key COLLATE pg_catalog."C",id)>((p_after->>'key') COLLATE pg_catalog."C",(p_after->>'id')::uuid)
  ORDER BY key COLLATE pg_catalog."C",id LIMIT 21
 ), numbered AS(SELECT *,row_number()OVER(ORDER BY key COLLATE pg_catalog."C",id)n FROM page)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
 'id',id,'name',name,'city',city,'country',country,'visibility',visibility_status,'revision',revision,'priceGroup',price_group) ORDER BY n) FROM numbered WHERE n<=20),'[]'),
 'nextCursor',(SELECT jsonb_build_object('query',p_query,'priceGroup',p_price_group,'filter',p_filter,'key',key,'id',id) FROM numbered WHERE n=20 AND EXISTS(SELECT FROM numbered WHERE n=21))) INTO result;
 RETURN result;
END;
$$;

CREATE FUNCTION public.preview_basic_withdrawal(p_filter jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE items jsonb; result jsonb; k text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF p_filter IS NULL OR jsonb_typeof(p_filter)<>'object' OR p_filter='{}' OR octet_length(p_filter::text)>10000 THEN RAISE EXCEPTION 'explicit bounded withdrawal filter required' USING ERRCODE='22023';END IF;
 FOR k IN SELECT jsonb_object_keys(p_filter) LOOP
  IF k NOT IN('ids','priceGroup','importRun','sourceId','ruleVersion') OR p_filter->k='null'::jsonb THEN RAISE EXCEPTION 'unknown withdrawal filter' USING ERRCODE='22023';END IF;
 END LOOP;
 IF p_filter?'ids' THEN
  IF jsonb_typeof(p_filter->'ids')<>'array' OR jsonb_array_length(p_filter->'ids') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'one to 100 IDs required' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements_text(p_filter->'ids') s(v) WHERE v IS NULL OR v!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'invalid withdrawal ID' USING ERRCODE='22023';END IF;
 END IF;
 IF (p_filter?'priceGroup' AND p_filter->>'priceGroup' NOT IN('A','B','C','D')) OR
 (p_filter?'ruleVersion' AND (jsonb_typeof(p_filter->'ruleVersion')<>'string' OR length(p_filter->>'ruleVersion') NOT BETWEEN 1 AND 100)) THEN RAISE EXCEPTION 'invalid withdrawal group/rule' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['importRun','sourceId'] LOOP
  IF p_filter?k AND (p_filter->>k)!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'invalid withdrawal reference' USING ERRCODE='22023';END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.id),'[]') INTO items FROM(
  SELECT a.id,a.name,a.revision FROM acquisition.accommodations a
  WHERE a.visibility_status='public' AND EXISTS(SELECT FROM public.basic_accommodation_contacts b WHERE b.id=a.id AND b.is_listed)
   AND(NOT p_filter?'ids' OR a.id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_filter->'ids')))
   AND(NOT p_filter?'priceGroup' OR acquisition.latest_basic_assessment(a.id)->>'priceGroup'=p_filter->>'priceGroup')
   AND(NOT p_filter?'ruleVersion' OR acquisition.latest_basic_assessment(a.id)->>'ruleVersion'=p_filter->>'ruleVersion' OR acquisition.latest_basic_assessment(a.id)->>'priceRuleVersion'=p_filter->>'ruleVersion')
   AND(NOT p_filter?'importRun' OR a.last_import_run_id=(p_filter->>'importRun')::uuid)
   AND(NOT p_filter?'sourceId' OR EXISTS(SELECT FROM acquisition.observations o WHERE o.id=a.primary_observation_id AND o.source_id=(p_filter->>'sourceId')::uuid))
  ORDER BY a.id LIMIT 101
 )m;
 IF jsonb_array_length(items)>100 THEN RAISE EXCEPTION 'withdrawal exceeds 100; narrow filter' USING ERRCODE='22023';END IF;
 result:=jsonb_build_object('filter',p_filter,'items',items);
 RETURN result||jsonb_build_object('count',jsonb_array_length(items),'token',encode(sha256(convert_to(result::text,'UTF8')),'hex'));
END;
$$;

CREATE FUNCTION public.withdraw_basic_contacts(p_filter jsonb,p_token text,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE preview jsonb; a acquisition.accommodations; expected jsonb; changed int:=0; run uuid; n int;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_review_travel_profiles() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF p_token IS NULL OR p_token!~'^[a-f0-9]{64}$' OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'token and reason required' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtext('reiseportal-private-source-import'));
 preview:=public.preview_basic_withdrawal(p_filter);
 IF preview->>'token' IS DISTINCT FROM p_token OR (preview->>'count')::int=0 THEN RAISE EXCEPTION 'withdrawal selection changed; preview again' USING ERRCODE='40001';END IF;
 run:=gen_random_uuid();
 INSERT INTO acquisition.processing_runs(id,run_type,rule_version,status,candidates,started_at,checkpoint)VALUES(run,'withdraw','admin-basic-withdraw-v1','running',(preview->>'count')::int,clock_timestamp(),jsonb_build_object('selectionToken',p_token,'filter',p_filter));
 FOR a IN SELECT * FROM acquisition.accommodations WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(preview->'items')) ORDER BY id FOR UPDATE LOOP
  SELECT value INTO expected FROM jsonb_array_elements(preview->'items') WHERE value->>'id'=a.id::text;
  IF a.revision<>(expected->>'revision')::bigint OR a.visibility_status<>'public' THEN RAISE EXCEPTION 'withdrawal revision changed' USING ERRCODE='40001';END IF;
  UPDATE public.basic_accommodation_contacts SET is_listed=false WHERE id=a.id AND is_listed;GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'public projection changed' USING ERRCODE='40001';END IF;
  UPDATE acquisition.accommodations SET visibility_status='withdrawn',approval_status='needs_review',publication_block='manual',withdrawn_at=clock_timestamp(),withdrawal_reason='admin_withdrawal',withdrawal_note=btrim(p_reason) WHERE id=a.id;
  INSERT INTO acquisition.audit_events(accommodation_id,run_id,actor,actor_user_id,event_type,reason,old_revision,new_revision,before_values,after_values)
  SELECT a.id,run,'portal_admin',auth.uid(),'basic_withdrawal',btrim(p_reason),a.revision,current.revision,jsonb_build_object('visibility',a.visibility_status),jsonb_build_object('visibility','withdrawn','filter',p_filter,'token',p_token) FROM acquisition.accommodations current WHERE current.id=a.id;
  changed:=changed+1;
 END LOOP;
 IF changed<>(preview->>'count')::int THEN RAISE EXCEPTION 'withdrawal set changed' USING ERRCODE='40001';END IF;
 UPDATE acquisition.processing_runs SET status='succeeded',verified=changed,finished_at=clock_timestamp() WHERE id=run;
 RETURN jsonb_build_object('withdrawn',changed,'runId',run);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_basic_assessment_page(text,jsonb,text,jsonb),public.preview_basic_withdrawal(jsonb),public.withdraw_basic_contacts(jsonb,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_basic_assessment_page(text,jsonb,text,jsonb),public.preview_basic_withdrawal(jsonb),public.withdraw_basic_contacts(jsonb,text,text) TO authenticated;
COMMIT;
