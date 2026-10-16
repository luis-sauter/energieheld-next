import {createHash} from 'node:crypto';
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function validateReviewedPilot(doc){
 if(!doc||doc.version!=='reviewed-basic-pilot-v1'||!uuid(doc.runId)||!Array.isArray(doc.records)||doc.records.length<1||doc.records.length>3||
  typeof doc.rightsAttestation!=='string'||!doc.rightsAttestation.trim()||!Number.isFinite(Date.parse(doc.checkedAt))||Date.parse(doc.checkedAt)>Date.now()+60000)throw Error('Invalid reviewed pilot manifest');
 const ids=new Set();
 for(const r of doc.records){
  if(!uuid(r.id)||ids.has(r.id)||!uuid(r.sourceId)||!uuid(r.municipalityId)||typeof r.name!=='string'||!r.name.trim()||r.name.length>300||
   !/^\+[1-9]\d{6,14}$/.test(r.phone)||!r.address||r.address.country!=='DE'||!r.address.city||!r.address.region||
   typeof r.address.street!=='string'||typeof r.address.houseNumber!=='string'||!/^\d{5}$/.test(r.address.postalCode)||
   !/^\d{8}$/.test(r.municipalityCode)||!r.municipalityName||!r.regionCode||r.accommodationType!=='accommodation:hotel'||
   !r.theme||!r.theme.key||!r.theme.fact||!Number.isFinite(r.price?.amount)||r.price.amount<=0||
   !Number.isFinite(r.price.tax)||r.price.tax<0||r.price.amount+r.price.tax>200||!r.price.start||!r.price.end||!r.price.board)throw Error('Incomplete reviewed pilot record');
  for(const key of ['contactUrl','themeUrl','priceUrl','municipalityUrl','termsUrl']){let u;try{u=new URL(r[key]);}catch{throw Error('Missing reviewed URL');}if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid reviewed URL');}
  if(new URL(r.contactUrl).hostname!==new URL(r.themeUrl).hostname||new URL(r.contactUrl).hostname!==new URL(r.priceUrl).hostname)throw Error('Pilot facts must use the reviewed first-party source');
  ids.add(r.id);
 }
 return doc;
}
export function reviewedPilotSql(input){
 const doc=validateReviewedPilot(input),hash=fingerprint(doc);
 const literal=JSON.stringify(doc).replace(/'/g,"''");
 return `-- PRIVATE REVIEWED PILOT: contains real business facts. Never commit this output.
-- Manifest SHA256: ${hash}; no network, media, CRM or Premium mutation.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $reviewed_pilot$
DECLARE doc jsonb:='${literal}'::jsonb; r jsonb; a acquisition.accommodations;
 manifest_hash text:='${hash}'; source_host text; fingerprint text; identity_id uuid; location_id uuid;
 phone_id uuid; theme_id uuid; price_id uuid; activity_id uuid; approval_id uuid; run_id uuid:=(doc->>'runId')::uuid;
BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolbypassrls) THEN RAISE EXCEPTION 'reviewed owner required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('reviewed-basic-pilot-v1'));
 IF EXISTS(SELECT FROM acquisition.processing_runs WHERE id=run_id) THEN
  IF NOT EXISTS(SELECT FROM acquisition.processing_runs WHERE id=run_id AND status='succeeded'
   AND checkpoint->>'manifest_sha256'=manifest_hash AND imported=jsonb_array_length(doc->'records')) THEN
   RAISE EXCEPTION 'pilot run differs or is incomplete';
  END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(doc->'records') e WHERE NOT EXISTS(
    SELECT FROM acquisition.accommodations WHERE id=(e->>'id')::uuid)) THEN RAISE EXCEPTION 'replay identity missing'; END IF;
  RETURN; -- Verified replay: preserve manual decisions, revisions and withdrawal.
 END IF;
 -- One small owner-reviewed pilot, not the future worker lock strategy. Prevent
 -- a racing profile creation during its cross-table identity preflight.
 LOCK TABLE public.company_profiles IN SHARE MODE;
 INSERT INTO acquisition.processing_runs(id,run_type,rule_version,adapter_version,status,started_at,candidates,batch_size,checkpoint)
 VALUES(run_id,'import','reviewed-basic-pilot-v1','manual-reviewed-v1','running',clock_timestamp(),jsonb_array_length(doc->'records'),3,
  jsonb_build_object('manifest_sha256',manifest_hash,'scope','one explicitly approved pilot'));
 FOR r IN SELECT value FROM jsonb_array_elements(doc->'records') ORDER BY value->>'id' LOOP
  source_host:=substring(r->>'contactUrl' from '^https://([^/]+)');
  IF EXISTS(SELECT FROM public.company_profiles p WHERE
    public.portal_search_normalize(p.display_name)=public.portal_search_normalize(r->>'name')
    OR regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')=regexp_replace(r->>'phone','[^0-9]','','g')
    OR lower(regexp_replace(coalesce(p.website,''),'^https?://(www\\.)?([^/]+).*$','\\2'))=lower(regexp_replace(source_host,'^www\\.',''))
    OR(public.portal_search_normalize(coalesce(p.city,''))=public.portal_search_normalize(r->'address'->>'city')
      AND coalesce(p.postal_code,'')=r->'address'->>'postalCode'
      AND public.portal_search_normalize(coalesce(p.street,''))=public.portal_search_normalize((r->'address'->>'street')||' '||(r->'address'->>'houseNumber'))))
   OR EXISTS(SELECT FROM acquisition.accommodations p WHERE
     public.portal_search_normalize(p.name::text)=public.portal_search_normalize(r->>'name') OR p.phone=r->>'phone')
  THEN RAISE EXCEPTION 'existing or ambiguous lodging; no import'; END IF;
  IF NOT(r->'theme'->>'key'=ANY(acquisition.basic_theme_keys())) THEN RAISE EXCEPTION 'inactive category'; END IF;
  IF NOT EXISTS(SELECT FROM public.travel_terms WHERE term_key=r->>'accommodationType' AND dimension='accommodation') THEN RAISE EXCEPTION 'invalid lodging type'; END IF;
  identity_id:=gen_random_uuid();location_id:=gen_random_uuid();phone_id:=gen_random_uuid();
  theme_id:=gen_random_uuid();price_id:=gen_random_uuid();activity_id:=gen_random_uuid();approval_id:=gen_random_uuid();
  source_host:=substring(r->>'contactUrl' from '^https://([^/]+)');
  INSERT INTO acquisition.source_registry(id,source_key,rule_version,operator_name,dataset_name,access_method,terms_url,
   access_right,research_right,extraction_right,publication_right,acquisition_right,allowed_fields,rights_evidence,reviewed_at,valid_from,request_budget,byte_budget)
  VALUES((r->>'sourceId')::uuid,'reviewed-pilot:'||source_host,'reviewed-basic-pilot-v1',r->>'name','Single first-party factual pilot','manual',r->>'termsUrl',
   'allowed','allowed','allowed','allowed','unknown',ARRAY['name','location','phone','travel_categories','price','activity'],doc->>'rightsAttestation',
   (doc->>'checkedAt')::timestamptz,(doc->>'checkedAt')::timestamptz,10,1048576);
  INSERT INTO acquisition.municipalities(id,country,code_system,official_code,name,region_code,region_name,valid_from,official_evidence)
  VALUES((r->>'municipalityId')::uuid,'DE','AGS',r->>'municipalityCode',r->>'municipalityName',r->>'regionCode',r->'address'->>'region','2026-09-30',r->>'municipalityUrl')
  ON CONFLICT(id) DO NOTHING;
  IF NOT EXISTS(SELECT FROM acquisition.municipalities m WHERE m.id=(r->>'municipalityId')::uuid AND m.country='DE' AND m.official_code=r->>'municipalityCode'
   AND m.name=r->>'municipalityName' AND m.region_code=r->>'regionCode' AND m.region_name=r->'address'->>'region') THEN RAISE EXCEPTION 'municipality differs'; END IF;
  INSERT INTO acquisition.accommodations(id,name,accommodation_type,street,house_number,postal_code,city,municipality_id,region_code,region_name,country,
   phone,primary_observation_id,location_observation_id,phone_observation_id,identity_status,contact_status,activity_status,eligibility_status,price_status,
   researched_at,checked_at,review_note)
  VALUES((r->>'id')::uuid,r->>'name',r->>'accommodationType',r->'address'->>'street',r->'address'->>'houseNumber',r->'address'->>'postalCode',r->'address'->>'city',
   (r->>'municipalityId')::uuid,r->>'regionCode',r->'address'->>'region','DE',r->>'phone',identity_id,location_id,phone_id,'clear','checked','active','eligible','qualifying',
   (doc->>'checkedAt')::timestamptz,(doc->>'checkedAt')::timestamptz,'Manually reviewed, separately approved small factual pilot');
  INSERT INTO acquisition.observations(id,accommodation_id,source_id,run_id,fact_type,term_key,url,facts,review_status,observed_at,checked_at,fingerprint)
  SELECT v.id,(r->>'id')::uuid,(r->>'sourceId')::uuid,run_id,v.type,v.term,v.url,v.facts,'verified',(doc->>'checkedAt')::timestamptz,(doc->>'checkedAt')::timestamptz,
   encode(sha256(convert_to(v.facts::text,'UTF8')),'hex')
  FROM(VALUES(identity_id,'identity',NULL::text,r->>'contactUrl',jsonb_build_object('name',r->>'name')),
   (location_id,'location',NULL::text,r->>'contactUrl',r->'address'),
   (phone_id,'phone',NULL::text,r->>'contactUrl',jsonb_build_object('phone',r->>'phone')),
   (theme_id,'theme',r->'theme'->>'key',r->>'themeUrl',jsonb_build_object('fact',r->'theme'->>'fact')),
   (price_id,'price',NULL::text,r->>'priceUrl',r->'price'),
   (activity_id,'activity',NULL::text,r->>'priceUrl',jsonb_build_object('fact','Published 2026/2027 bookable accommodation tariff')))v(id,type,term,url,facts);
  INSERT INTO acquisition.price_observations(accommodation_id,observation_id,original_amount,currency,basis,occupancy,nights,period_start,period_end,board,
   mandatory_extras,extras_verified,is_from_price,eur_per_person_night,comparison_status,observed_at)
  VALUES((r->>'id')::uuid,price_id,(r->'price'->>'amount')::numeric,'EUR','person_night',2,1,
   (r->'price'->>'start')::date,(r->'price'->>'end')::date,r->'price'->>'board',
   jsonb_build_object('person_night',(r->'price'->>'tax')::numeric),true,false,
   (r->'price'->>'amount')::numeric+(r->'price'->>'tax')::numeric,'comparable',(doc->>'checkedAt')::timestamptz);
  UPDATE acquisition.accommodations SET automatic_theme_evidence=jsonb_build_object(r->'theme'->>'key',theme_id::text) WHERE id=(r->>'id')::uuid;
  SELECT * INTO a FROM acquisition.accommodations WHERE id=(r->>'id')::uuid FOR UPDATE;
  fingerprint:=acquisition.basic_contact_fingerprint(a);
  INSERT INTO acquisition.audit_events(id,accommodation_id,run_id,actor,event_type,reason,fingerprint,old_revision,new_revision,after_values)
  VALUES(approval_id,a.id,run_id,'reviewed_owner','reviewed_pilot_publication','Explicit approval of this exact SQL and pilot; user source-rights attestation retained',
   fingerprint,a.revision,a.revision+1,jsonb_build_object('rule','reviewed-basic-pilot-v1','manifest_sha256',manifest_hash,'theme',r->'theme'->>'key'));
  UPDATE acquisition.accommodations SET approval_status='approved',visibility_status='public',approved_rule_version='reviewed-basic-pilot-v1',
   approval_event_id=approval_id,approved_fingerprint=fingerprint,published_at=clock_timestamp() WHERE id=a.id;
  INSERT INTO public.basic_accommodation_contacts(id,name,address,phone,is_listed,filter_keys,accommodation_type)
  SELECT id,name,jsonb_strip_nulls(jsonb_build_object('street',street,'houseNumber',house_number,'postalCode',postal_code,'city',city,'region',region_name,'country',country)),
   phone,true,effective_theme_keys,accommodation_type FROM acquisition.accommodations WHERE id=a.id;
 END LOOP;
 UPDATE acquisition.processing_runs SET status='succeeded',verified=candidates,imported=candidates,published=candidates,finished_at=clock_timestamp() WHERE id=run_id;
 UPDATE acquisition.accommodations SET last_import_run_id=run_id,last_import_at=(SELECT finished_at FROM acquisition.processing_runs WHERE id=run_id)
 WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(doc->'records'));
END;
$reviewed_pilot$;
COMMIT;
`;
}

