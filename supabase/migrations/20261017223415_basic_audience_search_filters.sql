-- Existing audience keys only, evidence-backed ordinary search filters.
-- No public payload field, API privilege, Premium or editor change.
BEGIN;SET LOCAL lock_timeout='2s';SET LOCAL statement_timeout='15s';
ALTER TABLE acquisition.accommodations ADD COLUMN approved_filter_evidence jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(approved_filter_evidence)='object');
CREATE FUNCTION acquisition.basic_filter_keys(a acquisition.accommodations) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT key ORDER BY key),'{}') FROM unnest(a.effective_theme_keys||ARRAY(SELECT jsonb_object_keys(a.approved_filter_evidence)))key;
$$;
CREATE FUNCTION acquisition.guard_basic_filter_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
IF TG_OP='INSERT' OR NEW.approved_filter_evidence IS DISTINCT FROM OLD.approved_filter_evidence THEN
 IF jsonb_typeof(NEW.approved_filter_evidence)<>'object' OR EXISTS(SELECT FROM jsonb_each(NEW.approved_filter_evidence)e WHERE
  NOT(e.key=ANY(ARRAY['audience:familie','audience:mit-hund','audience:paar','audience:gruppe'])) OR jsonb_typeof(e.value)<>'string'
  OR (e.value#>>'{}')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$') THEN RAISE EXCEPTION 'invalid normal search filter';END IF;
 IF EXISTS(SELECT FROM jsonb_each_text(NEW.approved_filter_evidence)e WHERE NOT EXISTS(
  SELECT FROM acquisition.observations o JOIN acquisition.source_registry s ON s.id=o.source_id
  JOIN public.travel_terms t ON t.term_key=o.term_key AND t.dimension='audience'
  WHERE o.id=e.value::uuid AND o.accommodation_id=NEW.id AND o.fact_type='filter' AND o.term_key=e.key
  AND o.review_status='verified' AND o.checked_at IS NOT NULL AND s.research_right='allowed' AND s.extraction_right='allowed'
  AND 'normal_search_filters'=ANY(s.allowed_fields) AND s.valid_from<=statement_timestamp()
  AND(s.valid_until IS NULL OR s.valid_until>statement_timestamp())
  AND NOT EXISTS(SELECT FROM acquisition.source_registry newer WHERE newer.supersedes_id=s.id AND newer.valid_from<=statement_timestamp()))) THEN
 RAISE EXCEPTION 'filter requires current verified same-lodging evidence'; END IF;
END IF;RETURN NEW;END;
$$;
CREATE TRIGGER guard_basic_filter_evidence BEFORE INSERT OR UPDATE ON acquisition.accommodations FOR EACH ROW EXECUTE FUNCTION acquisition.guard_basic_filter_evidence();
CREATE OR REPLACE FUNCTION acquisition.source_use_summary(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE a acquisition.accommodations; summary jsonb;
BEGIN
 SELECT * INTO a FROM acquisition.accommodations WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'accommodation not found' USING ERRCODE='P0002'; END IF;
 WITH required AS (
  SELECT * FROM (VALUES
   ('name',a.primary_observation_id,true,true),('location',a.location_observation_id,true,
    a.city IS NOT NULL OR a.street IS NOT NULL OR a.house_number IS NOT NULL OR a.postal_code IS NOT NULL OR a.country IS NOT NULL
    OR a.region_code IS NOT NULL OR a.region_name IS NOT NULL OR a.municipality_id IS NOT NULL),
   ('phone',a.phone_observation_id,true,a.phone IS NOT NULL),('operator_name',a.operator_observation_id,false,a.operator_name IS NOT NULL),
   ('company_address',a.company_address_observation_id,false,a.company_address_observation_id IS NOT NULL),
   ('acquisition_phone',a.acquisition_phone_observation_id,false,a.acquisition_phone IS NOT NULL),
   ('business_email',a.email_observation_id,false,a.business_email IS NOT NULL),
   ('official_website',a.website_observation_id,false,a.official_website IS NOT NULL),
   ('contact_person',a.person_observation_id,false,a.contact_person IS NOT NULL OR a.contact_role IS NOT NULL),
   ('business_relationship',a.business_relationship_observation_id,false,a.acquisition_status='premium_customer')
  ) r(field_key,observation_id,public_required,present)
  UNION ALL SELECT 'travel_categories',e.value::uuid,e.key=ANY(a.effective_theme_keys),true FROM jsonb_each_text(a.automatic_theme_evidence) e
  UNION ALL SELECT 'normal_search_filters',e.value::uuid,true,true FROM jsonb_each_text(a.approved_filter_evidence) e
 ), evaluated AS (
  SELECT purpose.key,CASE
   WHEN rights.state='denied' THEN 3
   WHEN o.id IS NULL OR o.review_status<>'verified' OR current_source.reviewed_at IS NULL OR s.id IS DISTINCT FROM current_source.id
    OR NOT(r.field_key=ANY(current_source.allowed_fields)) OR current_source.valid_from>statement_timestamp()
    OR (current_source.valid_until IS NOT NULL AND current_source.valid_until<=statement_timestamp()) OR rights.state='unknown' THEN 2
   WHEN rights.state='restricted' THEN 1 ELSE 0 END AS severity
  FROM required r LEFT JOIN acquisition.observations o ON o.id=r.observation_id AND o.accommodation_id=a.id
  LEFT JOIN acquisition.source_registry s ON s.id=o.source_id
  LEFT JOIN LATERAL (SELECT candidate.* FROM acquisition.source_registry candidate
   WHERE candidate.source_key=s.source_key AND candidate.valid_from<=statement_timestamp()
    AND NOT EXISTS(SELECT FROM acquisition.source_registry newer WHERE newer.supersedes_id=candidate.id AND newer.valid_from<=statement_timestamp())
   LIMIT 1) current_source ON true
  CROSS JOIN (VALUES('access'),('research'),('extraction'),('publication'),('acquisition')) purpose(key)
  CROSS JOIN LATERAL (SELECT CASE purpose.key WHEN 'access' THEN current_source.access_right WHEN 'research' THEN current_source.research_right
   WHEN 'extraction' THEN current_source.extraction_right WHEN 'publication' THEN current_source.publication_right ELSE current_source.acquisition_right END state) rights
  WHERE CASE WHEN purpose.key='publication' THEN r.public_required ELSE r.present END
 ), grouped AS (SELECT key,max(severity) severity FROM evaluated GROUP BY key)
 SELECT jsonb_object_agg(key,CASE severity WHEN 3 THEN 'denied' WHEN 2 THEN 'unknown' WHEN 1 THEN 'restricted' ELSE 'allowed' END)
 INTO summary FROM grouped;
 RETURN summary;
END;
$function$
;
-- Change only filter composition; preserve the currently installed theme and
-- publication conditions instead of replacing them with an optional-theme draft.
DO $adapt$ DECLARE body text; BEGIN
body:=pg_get_functiondef('acquisition.sync_basic_contact()'::regprocedure);
IF position('filter_keys=NEW.effective_theme_keys' in body)=0 THEN RAISE EXCEPTION 'Unexpected sync definition';END IF;
EXECUTE replace(body,'filter_keys=NEW.effective_theme_keys','filter_keys=acquisition.basic_filter_keys(NEW)');
body:=pg_get_functiondef('acquisition.guard_basic_projection()'::regprocedure);
IF position('NEW.filter_keys IS DISTINCT FROM a.effective_theme_keys' in body)=0 THEN RAISE EXCEPTION 'Unexpected projection definition';END IF;
body:=replace(body,'NEW.filter_keys IS DISTINCT FROM a.effective_theme_keys','NEW.filter_keys IS DISTINCT FROM acquisition.basic_filter_keys(a)');
body:=replace(body,'OR o.id IN(SELECT value::uuid FROM jsonb_each_text(a.automatic_theme_evidence))','OR o.id IN(SELECT value::uuid FROM jsonb_each_text(a.automatic_theme_evidence)) OR o.id IN(SELECT value::uuid FROM jsonb_each_text(a.approved_filter_evidence))');
EXECUTE body; END $adapt$;
REVOKE ALL ON FUNCTION acquisition.basic_filter_keys(acquisition.accommodations),acquisition.guard_basic_filter_evidence() FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;
COMMIT;
