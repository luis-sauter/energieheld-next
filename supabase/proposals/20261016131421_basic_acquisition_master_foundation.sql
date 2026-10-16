-- LOCAL FOUNDATION DRAFT ONLY. Not approved; never db push this directory.
-- Seven private tables; empty, closed public projection. No seeds or jobs.
-- Publication, least-privilege worker capabilities and search are later phases.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND rolbypassrls) THEN
  RAISE EXCEPTION 'reviewed BYPASSRLS migration owner required';
 END IF;
END $$;
CREATE SCHEMA acquisition;
REVOKE ALL ON SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE acquisition.source_registry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_key varchar(200) NOT NULL CHECK(length(btrim(source_key))>0),
 rule_version varchar(100) NOT NULL CHECK(length(btrim(rule_version))>0),
 operator_name varchar(300) NOT NULL,
 dataset_name varchar(300) NOT NULL,
 coverage jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(coverage)='object'),
 access_method text NOT NULL CHECK(access_method IN('api','dataset','website','manual')),
 terms_url text NOT NULL CHECK(terms_url ~ '^https?://[^[:space:]]+$'),
 licence text,
 -- Each purpose is independent. Public reachability is not a licence.
 access_right text NOT NULL DEFAULT 'unknown' CHECK(access_right IN('unknown','allowed','restricted','denied')),
 research_right text NOT NULL DEFAULT 'unknown' CHECK(research_right IN('unknown','allowed','restricted','denied')),
 extraction_right text NOT NULL DEFAULT 'unknown' CHECK(extraction_right IN('unknown','allowed','restricted','denied')),
 publication_right text NOT NULL DEFAULT 'unknown' CHECK(publication_right IN('unknown','allowed','restricted','denied')),
 acquisition_right text NOT NULL DEFAULT 'unknown' CHECK(acquisition_right IN('unknown','allowed','restricted','denied')),
 allowed_fields text[] NOT NULL DEFAULT '{}',
 restrictions jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(restrictions)='object'),
 rights_evidence text,
 reviewed_at timestamptz,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz,
 request_budget integer NOT NULL CHECK(request_budget BETWEEN 1 AND 100),
 byte_budget bigint NOT NULL CHECK(byte_budget BETWEEN 1 AND 10485760),
 min_request_interval_ms integer NOT NULL DEFAULT 1000 CHECK(min_request_interval_ms>=1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_key,rule_version),
 UNIQUE(id,source_key),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK((access_right='unknown' AND research_right='unknown' AND extraction_right='unknown'
  AND publication_right='unknown' AND acquisition_right='unknown')
  OR (reviewed_at IS NOT NULL AND length(btrim(rights_evidence))>0 AND rights_evidence IS NOT NULL))
);

CREATE TABLE acquisition.municipalities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 country text NOT NULL CHECK(country IN('DE','AT','CH','IT')),
 code_system text NOT NULL CHECK(code_system IN('AGS','GKZ','BFS','ISTAT')),
 official_code varchar(20) NOT NULL,
 name varchar(200) NOT NULL CHECK(length(btrim(name))>0),
 region_code varchar(50) NOT NULL,
 region_name varchar(200) NOT NULL,
 valid_from date NOT NULL,
 valid_until date,
 predecessor_ids uuid[] NOT NULL DEFAULT '{}',
 successor_ids uuid[] NOT NULL DEFAULT '{}',
 official_evidence text NOT NULL CHECK(official_evidence ~ '^https?://[^[:space:]]+$'),
 UNIQUE(country,code_system,official_code,valid_from),
 UNIQUE(id,country,region_code,region_name),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK((country='DE' AND code_system='AGS' AND official_code ~ '^[0-9]{8}$')
  OR (country='AT' AND code_system='GKZ' AND official_code ~ '^[0-9]{5}$')
  OR (country='CH' AND code_system='BFS' AND official_code ~ '^[0-9]{1,4}$')
  OR (country='IT' AND code_system='ISTAT' AND official_code ~ '^021[0-9]{3}$'))
);

CREATE TABLE acquisition.processing_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 parent_run_id uuid REFERENCES acquisition.processing_runs(id),
 run_type text NOT NULL CHECK(run_type IN('research','import','refresh','publish','withdraw','correction','coverage')),
 source_id uuid REFERENCES acquisition.source_registry(id),
 municipality_id uuid REFERENCES acquisition.municipalities(id),
 rule_version varchar(100) NOT NULL,
 adapter_version varchar(100),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN('planned','running','paused','succeeded','partial','failed','cancelled')),
 checkpoint jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(checkpoint)='object'),
 coverage_status text CHECK(coverage_status IN('not_started','sample','partial','documented_scope_complete','review_required')),
 candidates integer NOT NULL DEFAULT 0 CHECK(candidates>=0),
 verified integer NOT NULL DEFAULT 0 CHECK(verified>=0 AND verified<=candidates),
 imported integer NOT NULL DEFAULT 0 CHECK(imported>=0 AND imported<=candidates),
 published integer NOT NULL DEFAULT 0 CHECK(published>=0 AND published<=candidates),
 excluded integer NOT NULL DEFAULT 0 CHECK(excluded>=0 AND excluded<=candidates),
 unresolved integer NOT NULL DEFAULT 0 CHECK(unresolved>=0 AND unresolved<=candidates),
 requests_used integer NOT NULL DEFAULT 0 CHECK(requests_used BETWEEN 0 AND 100),
 bytes_received bigint NOT NULL DEFAULT 0 CHECK(bytes_received BETWEEN 0 AND 10485760),
 batch_size integer NOT NULL DEFAULT 50 CHECK(batch_size BETWEEN 1 AND 50),
 error_code varchar(200),
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 finished_at timestamptz,
 CHECK(parent_run_id IS DISTINCT FROM id),
 CHECK(finished_at IS NULL OR (started_at IS NOT NULL AND finished_at>=started_at)),
 CHECK(status NOT IN('succeeded','partial','failed','cancelled') OR finished_at IS NOT NULL)
);
CREATE INDEX processing_parent_idx ON acquisition.processing_runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
CREATE INDEX processing_source_idx ON acquisition.processing_runs(source_id,created_at DESC);
CREATE INDEX processing_municipality_idx ON acquisition.processing_runs(municipality_id,created_at DESC);

CREATE TABLE acquisition.accommodations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- independent of source identities
 name varchar(300) NOT NULL CHECK(length(btrim(name))>0),
 accommodation_type text REFERENCES public.travel_terms(term_key) CHECK(accommodation_type IN
  ('accommodation:hotel','accommodation:ferienwohnung','accommodation:pension','accommodation:camping')),
 original_accommodation_type varchar(200),
 operator_name varchar(300),
 existing_profile_id uuid UNIQUE REFERENCES public.company_profiles(id) ON DELETE SET NULL,
 had_profile_link boolean NOT NULL DEFAULT false,
 canonical_accommodation_id uuid REFERENCES acquisition.accommodations(id),
 street varchar(200),
 house_number varchar(50),
 postal_code varchar(20),
 city varchar(200),
 municipality_id uuid REFERENCES acquisition.municipalities(id),
 region_code varchar(50),
 region_name varchar(200),
 country text CHECK(country IN('DE','AT','CH','IT')),
 original_source_address varchar(1000),
 company_street varchar(200),
 company_house_number varchar(50),
 company_postal_code varchar(20),
 company_city varchar(200),
 company_region_code varchar(50),
 company_region_name varchar(200),
 company_country text CHECK(company_country ~ '^[A-Z]{2}$'),
 phone text CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 acquisition_phone text CHECK(acquisition_phone ~ '^\+[1-9][0-9]{6,14}$'),
 business_email varchar(320) CHECK(business_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 official_website text CHECK(official_website ~ '^https?://[^[:space:]]+$'),
 contact_person varchar(200),
 contact_role varchar(200),
 primary_observation_id uuid NOT NULL,
 location_observation_id uuid,
 phone_observation_id uuid,
 operator_observation_id uuid,
 company_address_observation_id uuid,
 acquisition_phone_observation_id uuid,
 email_observation_id uuid,
 website_observation_id uuid,
 person_observation_id uuid,
 acquisition_status text NOT NULL DEFAULT 'new' CHECK(acquisition_status IN
  ('new','contact_planned','contacted','response_received','interested','not_interested','premium_customer')),
 acquisition_note varchar(4000),
 follow_up_on date,
 last_contact_at timestamptz,
 contact_channel text CHECK(contact_channel IN('phone','email','post','in_person','other')),
 contact_block boolean NOT NULL DEFAULT false,
 contact_block_reason varchar(500),
 business_relationship_observation_id uuid,
 identity_status text NOT NULL DEFAULT 'unreviewed' CHECK(identity_status IN('unreviewed','clear','needs_review','duplicate')),
 contact_status text NOT NULL DEFAULT 'unreviewed' CHECK(contact_status IN('unreviewed','checked','needs_review')),
 activity_status text NOT NULL DEFAULT 'unknown' CHECK(activity_status IN('unknown','active','seasonal','temporarily_closed','permanently_closed')),
 eligibility_status text NOT NULL DEFAULT 'pending' CHECK(eligibility_status IN('pending','eligible','ineligible','exception_required')),
 price_status text NOT NULL DEFAULT 'pending' CHECK(price_status IN('pending','qualifying','indicative','no_qualifying_rate','conflicting')),
 problem_codes text[] NOT NULL DEFAULT '{}',
 review_note varchar(4000),
 review_status text GENERATED ALWAYS AS (CASE
  WHEN identity_status='duplicate' OR eligibility_status='ineligible' OR activity_status='permanently_closed' THEN 'excluded'
  WHEN identity_status='needs_review' OR contact_status='needs_review' OR eligibility_status='exception_required'
   OR price_status='conflicting' OR cardinality(problem_codes)>0 THEN 'needs_review'
  WHEN identity_status='clear' AND contact_status='checked' AND eligibility_status='eligible'
   AND activity_status IN('active','seasonal') AND price_status='qualifying' THEN 'checked'
  WHEN identity_status='unreviewed' AND contact_status='unreviewed' AND eligibility_status='pending'
   AND activity_status='unknown' AND price_status='pending' THEN 'unreviewed'
  ELSE 'in_progress' END) STORED,
 researched_at timestamptz,
 checked_at timestamptz,
 next_review_on date,
 last_import_run_id uuid REFERENCES acquisition.processing_runs(id),
 last_import_at timestamptz,
 approval_status text NOT NULL DEFAULT 'not_requested' CHECK(approval_status IN('not_requested','proposed','approved','rejected','needs_review')),
 visibility_status text NOT NULL DEFAULT 'never_published' CHECK(visibility_status IN('never_published','public','withdrawn')),
 approved_rule_version varchar(100),
 approval_event_id uuid,
 approved_fingerprint text CHECK(approved_fingerprint ~ '^[a-f0-9]{64}$'),
 price_exception_event_id uuid,
 publication_block text CHECK(publication_block IN('manual','profile_link','duplicate','rights','closure','data_conflict','not_activated')),
 published_at timestamptz,
 withdrawn_at timestamptz,
 withdrawal_reason text,
 withdrawal_note varchar(4000),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(municipality_id,country,region_code,region_name)
  REFERENCES acquisition.municipalities(id,country,region_code,region_name),
 CHECK(canonical_accommodation_id IS DISTINCT FROM id),
 CHECK((canonical_accommodation_id IS NOT NULL)=(identity_status='duplicate')),
 CHECK(NOT contact_block OR (contact_block_reason IS NOT NULL AND length(btrim(contact_block_reason))>0)),
 CHECK(acquisition_status<>'premium_customer' OR business_relationship_observation_id IS NOT NULL),
 CHECK(operator_name IS NULL OR operator_observation_id IS NOT NULL),
 CHECK(phone IS NULL OR phone_observation_id IS NOT NULL),
 CHECK(acquisition_phone IS NULL OR acquisition_phone_observation_id IS NOT NULL),
 CHECK(business_email IS NULL OR email_observation_id IS NOT NULL),
 CHECK(official_website IS NULL OR website_observation_id IS NOT NULL),
 CHECK((contact_person IS NULL AND contact_role IS NULL) OR person_observation_id IS NOT NULL),
 CHECK((company_street IS NULL AND company_house_number IS NULL AND company_postal_code IS NULL
  AND company_city IS NULL AND company_region_code IS NULL AND company_region_name IS NULL AND company_country IS NULL)
  OR company_address_observation_id IS NOT NULL),
 CHECK((last_import_run_id IS NULL) = (last_import_at IS NULL)),
 -- Foundation deliberately cannot activate publication. Later phases must
 -- replace this barrier with reviewed rule decisions, never a client-side flag.
 CONSTRAINT foundation_publication_inactive CHECK(visibility_status<>'public' AND approval_status<>'approved')
);
CREATE INDEX accommodation_municipality_idx ON acquisition.accommodations(municipality_id,id);
CREATE INDEX accommodation_canonical_idx ON acquisition.accommodations(canonical_accommodation_id) WHERE canonical_accommodation_id IS NOT NULL;
CREATE INDEX accommodation_review_idx ON acquisition.accommodations(next_review_on,id);
CREATE INDEX accommodation_acquisition_idx ON acquisition.accommodations(acquisition_status,follow_up_on,id);
CREATE INDEX accommodation_import_idx ON acquisition.accommodations(last_import_run_id) WHERE last_import_run_id IS NOT NULL;

CREATE TABLE acquisition.observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 accommodation_id uuid NOT NULL REFERENCES acquisition.accommodations(id),
 source_id uuid NOT NULL REFERENCES acquisition.source_registry(id),
 run_id uuid NOT NULL REFERENCES acquisition.processing_runs(id),
 source_key varchar(200) NOT NULL,
 external_key varchar(500),
 -- The current binding is unique; historic versions remain ordinary facts.
 fact_type text NOT NULL CHECK(fact_type IN('identity_binding','identity','location','phone','operator','company_address',
  'acquisition_phone','email','website','person','business_relationship','theme','filter','activity','price','correction')),
 term_key text REFERENCES public.travel_terms(term_key),
 url text NOT NULL CHECK(url ~ '^https?://[^[:space:]]+$'),
 facts jsonb NOT NULL CHECK(jsonb_typeof(facts)='object' AND octet_length(facts::text)<=8192),
 review_status text NOT NULL DEFAULT 'unreviewed' CHECK(review_status IN('unreviewed','verified','conflicting','rejected')),
 observed_at timestamptz NOT NULL,
 checked_at timestamptz,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,accommodation_id),
 UNIQUE(accommodation_id,source_id,fact_type,fingerprint),
 FOREIGN KEY(source_id,source_key) REFERENCES acquisition.source_registry(id,source_key),
 CHECK(fact_type NOT IN('theme','filter') OR term_key IS NOT NULL),
 CHECK(fact_type<>'identity_binding' OR (external_key IS NOT NULL AND length(btrim(external_key))>0)),
 CHECK(review_status='unreviewed' OR checked_at IS NOT NULL)
);
-- Same external identity cannot point to another accommodation after a source
-- rule/version changes. Older evidence stays bound to its original version.
CREATE UNIQUE INDEX observation_binding_idx ON acquisition.observations(source_key,external_key) WHERE fact_type='identity_binding';
CREATE INDEX observation_accommodation_idx ON acquisition.observations(accommodation_id,observed_at DESC);
CREATE INDEX observation_source_idx ON acquisition.observations(source_id);
CREATE INDEX observation_run_idx ON acquisition.observations(run_id);
CREATE INDEX observation_term_idx ON acquisition.observations(term_key,accommodation_id) WHERE term_key IS NOT NULL;

DO $$ DECLARE field text; BEGIN
 FOREACH field IN ARRAY ARRAY['primary_observation_id','location_observation_id','phone_observation_id','operator_observation_id',
  'company_address_observation_id','acquisition_phone_observation_id','email_observation_id','website_observation_id',
  'person_observation_id','business_relationship_observation_id'] LOOP
  EXECUTE format('ALTER TABLE acquisition.accommodations ADD CONSTRAINT %I FOREIGN KEY(%I,id) REFERENCES acquisition.observations(id,accommodation_id) DEFERRABLE INITIALLY DEFERRED',field||'_same_lodging',field);
  EXECUTE format('CREATE INDEX %I ON acquisition.accommodations(%I,id) WHERE %I IS NOT NULL',field||'_idx',field,field);
 END LOOP;
END $$;

CREATE TABLE acquisition.price_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 accommodation_id uuid NOT NULL REFERENCES acquisition.accommodations(id),
 observation_id uuid NOT NULL,
 original_amount numeric NOT NULL CHECK(original_amount>0 AND original_amount<'Infinity'::numeric),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 basis text NOT NULL CHECK(basis IN('person_night','unit_night','person_stay','unit_stay','unknown')),
 occupancy integer CHECK(occupancy>0),
 nights integer CHECK(nights>0),
 period_start date,
 period_end date,
 board varchar(200),
 minimum_stay integer CHECK(minimum_stay>0),
 mandatory_extras jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(mandatory_extras)='object'),
 extras_verified boolean NOT NULL DEFAULT false,
 is_from_price boolean NOT NULL DEFAULT false,
 exchange_rate numeric CHECK(exchange_rate>0 AND exchange_rate<'Infinity'::numeric),
 exchange_rate_at timestamptz,
 exchange_rate_observation_id uuid,
 eur_per_person_night numeric CHECK(eur_per_person_night>0 AND eur_per_person_night<'Infinity'::numeric),
 comparison_status text NOT NULL DEFAULT 'unreviewed' CHECK(comparison_status IN('unreviewed','comparable','indicative','conflicting')),
 observed_at timestamptz NOT NULL,
 FOREIGN KEY(observation_id,accommodation_id) REFERENCES acquisition.observations(id,accommodation_id),
 FOREIGN KEY(exchange_rate_observation_id,accommodation_id) REFERENCES acquisition.observations(id,accommodation_id),
 CHECK(period_end IS NULL OR (period_start IS NOT NULL AND period_end>=period_start)),
 CHECK(eur_per_person_night IS NULL OR (basis<>'unknown' AND extras_verified
  AND period_start IS NOT NULL AND period_end IS NOT NULL AND board IS NOT NULL
  AND (basis NOT IN('unit_night','unit_stay') OR occupancy IS NOT NULL)
  AND (basis NOT IN('person_stay','unit_stay') OR nights IS NOT NULL)
  AND (minimum_stay IS NULL OR (nights IS NOT NULL AND nights>=minimum_stay))
  AND (currency='EUR' OR (exchange_rate IS NOT NULL AND exchange_rate_at IS NOT NULL AND exchange_rate_observation_id IS NOT NULL)))),
 CHECK(comparison_status<>'comparable' OR eur_per_person_night IS NOT NULL)
);
CREATE INDEX price_accommodation_idx ON acquisition.price_observations(accommodation_id,observed_at DESC);
CREATE INDEX price_observation_idx ON acquisition.price_observations(observation_id,accommodation_id);
CREATE INDEX price_exchange_idx ON acquisition.price_observations(exchange_rate_observation_id,accommodation_id) WHERE exchange_rate_observation_id IS NOT NULL;

CREATE TABLE acquisition.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 accommodation_id uuid REFERENCES acquisition.accommodations(id),
 candidate_reference varchar(500),
 run_id uuid REFERENCES acquisition.processing_runs(id),
 actor text NOT NULL CHECK(length(btrim(actor))>0),
 event_type varchar(100) NOT NULL,
 changed_fields text[] NOT NULL DEFAULT '{}',
 old_revision bigint CHECK(old_revision>0),
 new_revision bigint CHECK(new_revision>0),
 reason varchar(4000),
 rule_version varchar(100),
 fingerprint text CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 happened_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,accommodation_id),
 CHECK(accommodation_id IS NOT NULL OR candidate_reference IS NOT NULL),
 CHECK(new_revision IS NULL OR old_revision IS NULL OR new_revision>old_revision)
);
CREATE INDEX audit_accommodation_idx ON acquisition.audit_events(accommodation_id,happened_at DESC);
CREATE INDEX audit_run_idx ON acquisition.audit_events(run_id) WHERE run_id IS NOT NULL;
ALTER TABLE acquisition.accommodations ADD CONSTRAINT approval_same_lodging FOREIGN KEY(approval_event_id,id) REFERENCES acquisition.audit_events(id,accommodation_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE acquisition.accommodations ADD CONSTRAINT price_exception_same_lodging FOREIGN KEY(price_exception_event_id,id) REFERENCES acquisition.audit_events(id,accommodation_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX accommodation_approval_idx ON acquisition.accommodations(approval_event_id,id) WHERE approval_event_id IS NOT NULL;
CREATE INDEX accommodation_price_exception_idx ON acquisition.accommodations(price_exception_event_id,id) WHERE price_exception_event_id IS NOT NULL;

CREATE TABLE public.basic_accommodation_contacts (
 id uuid PRIMARY KEY REFERENCES acquisition.accommodations(id),
 name varchar(300) NOT NULL CHECK(length(btrim(name))>0),
 address jsonb NOT NULL CHECK(jsonb_typeof(address)='object'
  AND address - ARRAY['city','region','country','street','houseNumber','postalCode']='{}'::jsonb
  AND address ?& ARRAY['city','region','country']
  AND jsonb_typeof(address->'city')='string' AND length(btrim(address->>'city')) BETWEEN 1 AND 200
  AND jsonb_typeof(address->'region')='string' AND length(btrim(address->>'region')) BETWEEN 1 AND 200
  AND jsonb_typeof(address->'country')='string' AND address->>'country' IN('DE','AT','CH','IT')
  AND (NOT address ? 'street' OR jsonb_typeof(address->'street')='null' OR (jsonb_typeof(address->'street')='string' AND length(address->>'street')<=200))
  AND (NOT address ? 'houseNumber' OR jsonb_typeof(address->'houseNumber')='null' OR (jsonb_typeof(address->'houseNumber')='string' AND length(address->>'houseNumber')<=50))
  AND (NOT address ? 'postalCode' OR jsonb_typeof(address->'postalCode')='null' OR (jsonb_typeof(address->'postalCode')='string' AND length(address->>'postalCode')<=20))),
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 is_listed boolean NOT NULL DEFAULT false CONSTRAINT foundation_listing_inactive CHECK(NOT is_listed),
 search_vector tsvector GENERATED ALWAYS AS (to_tsvector('pg_catalog.german'::regconfig,
  name||' '||(address->>'city')||' '||(address->>'region')||' '||(address->>'country')||' '||
  coalesce(address->>'postalCode','')||' '||coalesce(address->>'street','')||' '||coalesce(address->>'houseNumber',''))) STORED
);
CREATE INDEX basic_contact_name_idx ON public.basic_accommodation_contacts(lower(name),id);
CREATE INDEX basic_contact_search_idx ON public.basic_accommodation_contacts USING gin(search_vector);
-- No public SELECT grant or read policy until the later safe provider rollout.
ALTER TABLE public.basic_accommodation_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basic_accommodation_contacts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.basic_accommodation_contacts FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION acquisition.preserve_history() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'immutable history; append a new observation or decision'; END;
$$;
CREATE TRIGGER immutable_source_version BEFORE UPDATE OR DELETE ON acquisition.source_registry FOR EACH ROW EXECUTE FUNCTION acquisition.preserve_history();
CREATE TRIGGER immutable_observation BEFORE UPDATE OR DELETE ON acquisition.observations FOR EACH ROW EXECUTE FUNCTION acquisition.preserve_history();
CREATE TRIGGER immutable_price BEFORE UPDATE OR DELETE ON acquisition.price_observations FOR EACH ROW EXECUTE FUNCTION acquisition.preserve_history();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON acquisition.audit_events FOR EACH ROW EXECUTE FUNCTION acquisition.preserve_history();

CREATE FUNCTION acquisition.set_observation_source() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 SELECT source_key INTO NEW.source_key FROM acquisition.source_registry WHERE id=NEW.source_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER set_observation_source BEFORE INSERT ON acquisition.observations FOR EACH ROW EXECUTE FUNCTION acquisition.set_observation_source();

CREATE FUNCTION acquisition.guard_accommodation() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'retain canonical accommodation identity'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'immutable accommodation identity'; END IF;
  IF NEW.revision<>OLD.revision THEN RAISE EXCEPTION 'revision is database managed'; END IF;
  IF NEW.acquisition_status IS DISTINCT FROM OLD.acquisition_status
   AND (NEW.review_note IS NULL OR NEW.review_note IS NOT DISTINCT FROM OLD.review_note) THEN
   RAISE EXCEPTION 'acquisition transition needs a fresh reason';
  END IF;
  NEW.revision:=OLD.revision+1;
  NEW.created_at:=OLD.created_at;
  NEW.had_profile_link:=OLD.had_profile_link OR OLD.existing_profile_id IS NOT NULL OR NEW.existing_profile_id IS NOT NULL;
 ELSE
  NEW.revision:=1;
  NEW.created_at:=clock_timestamp();
  NEW.had_profile_link:=NEW.existing_profile_id IS NOT NULL;
 END IF;
 NEW.updated_at:=clock_timestamp();
 IF NEW.had_profile_link THEN
  IF TG_OP='UPDATE' THEN NEW.publication_block:=coalesce(OLD.publication_block,NEW.publication_block,'profile_link');
  ELSE NEW.publication_block:=coalesce(NEW.publication_block,'profile_link'); END IF;
 END IF;
 IF NEW.checked_at IS NOT NULL THEN NEW.next_review_on:=(NEW.checked_at AT TIME ZONE 'UTC')::date+180;
 ELSE NEW.next_review_on:=NULL; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_accommodation BEFORE INSERT OR UPDATE OR DELETE ON acquisition.accommodations FOR EACH ROW EXECUTE FUNCTION acquisition.guard_accommodation();

-- Final transaction state must be a direct canonical link, never a chain.
-- Multi-session identity merges still require the later ordered-lock procedure;
-- there is deliberately no importer/merge privilege in this foundation.
CREATE FUNCTION acquisition.check_canonical_link() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT FROM acquisition.accommodations a
  JOIN acquisition.accommodations target ON target.id=a.canonical_accommodation_id
  WHERE (a.id=NEW.id OR target.id=NEW.id) AND target.canonical_accommodation_id IS NOT NULL) THEN
  RAISE EXCEPTION 'canonical accommodation must not be a duplicate or link chain';
 END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER check_canonical_link AFTER INSERT OR UPDATE ON acquisition.accommodations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition.check_canonical_link();

CREATE FUNCTION acquisition.audit_accommodation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fields text[];
BEGIN
 SELECT coalesce(array_agg(n.key ORDER BY n.key),'{}') INTO fields FROM jsonb_each(to_jsonb(NEW)) n
 WHERE TG_OP='INSERT' OR n.value IS DISTINCT FROM to_jsonb(OLD)->n.key;
 INSERT INTO acquisition.audit_events(accommodation_id,actor,event_type,changed_fields,old_revision,new_revision,reason)
 VALUES(NEW.id,session_user,TG_OP,fields,CASE WHEN TG_OP='UPDATE' THEN OLD.revision END,NEW.revision,NEW.review_note);
 RETURN NEW;
END;
$$;
CREATE TRIGGER audit_accommodation AFTER INSERT OR UPDATE ON acquisition.accommodations FOR EACH ROW EXECUTE FUNCTION acquisition.audit_accommodation();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; r text; BEGIN
 FOREACH t IN ARRAY ARRAY['accommodations','source_registry','observations','price_observations','municipalities','processing_runs','audit_events'] LOOP
  EXECUTE format('ALTER TABLE acquisition.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE acquisition.%I FORCE ROW LEVEL SECURITY',t);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_schema_privilege(r,'acquisition','USAGE,CREATE')
    OR has_table_privilege(r,format('acquisition.%I',t),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(r,format('acquisition.%I',t),'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'unexpected acquisition privilege';
   END IF;
  END LOOP;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(r,'public.basic_accommodation_contacts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(r,'public.basic_accommodation_contacts','SELECT,INSERT,UPDATE,REFERENCES')
   OR has_function_privilege(r,'acquisition.preserve_history()','EXECUTE')
   OR has_function_privilege(r,'acquisition.guard_accommodation()','EXECUTE')
   OR has_function_privilege(r,'acquisition.check_canonical_link()','EXECUTE')
   OR has_function_privilege(r,'acquisition.set_observation_source()','EXECUTE')
   OR has_function_privilege(r,'acquisition.audit_accommodation()','EXECUTE') THEN
   RAISE EXCEPTION 'unexpected projection or function privilege';
  END IF;
 END LOOP;
END $$;
COMMIT;
