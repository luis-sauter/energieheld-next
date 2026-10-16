-- LOCAL FOUNDATION DRAFT ONLY. Not approved; never db push this directory.
-- Seven private tables; empty, closed public projection. No seeds or jobs.
-- Publication and search stay inactive. The sole NOLOGIN worker capability
-- can update validated category evidence only; no login or membership is added.
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

CREATE ROLE acquisition_category_importer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

CREATE FUNCTION acquisition.basic_theme_keys() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['theme:natur-pur','theme:nordic-walking','theme:radwandern','theme:wanderurlaub',
 'theme:familienurlaub','theme:golfurlaub','theme:urlaub-am-wasser','theme:campingurlaub',
 'theme:romantik-zu-zweit','theme:wellnessangebote','theme:geschaeftsreisen']::text[];
$$;
CREATE FUNCTION acquisition.valid_category_state(automatic jsonb,manual jsonb) RETURNS boolean
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN jsonb_typeof(automatic)<>'object' OR jsonb_typeof(manual)<>'object' THEN false ELSE
  NOT EXISTS(SELECT FROM jsonb_each(automatic) e WHERE NOT(e.key=ANY(acquisition.basic_theme_keys()))
   OR jsonb_typeof(e.value)<>'string' OR (e.value#>>'{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  AND NOT EXISTS(SELECT FROM jsonb_each(manual) e WHERE NOT(e.key=ANY(acquisition.basic_theme_keys()))
   OR jsonb_typeof(e.value)<>'boolean') END;
$$;
CREATE FUNCTION acquisition.effective_category_keys(automatic jsonb,manual jsonb) RETURNS text[]
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(array_agg(k ORDER BY k),'{}'::text[]) FROM unnest(acquisition.basic_theme_keys()) k
 WHERE CASE WHEN manual ? k THEN manual->k='true'::jsonb ELSE automatic ? k END;
$$;

CREATE TABLE acquisition.source_registry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_key varchar(200) NOT NULL CHECK(length(btrim(source_key))>0),
 rule_version varchar(100) NOT NULL CHECK(length(btrim(rule_version))>0),
 supersedes_id uuid UNIQUE,
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
 FOREIGN KEY(supersedes_id,source_key) REFERENCES acquisition.source_registry(id,source_key),
 CHECK(supersedes_id IS DISTINCT FROM id),
 CHECK(valid_until IS NULL OR valid_until>valid_from),
 CHECK((access_right='unknown' AND research_right='unknown' AND extraction_right='unknown'
  AND publication_right='unknown' AND acquisition_right='unknown')
  OR (reviewed_at IS NOT NULL AND length(btrim(rights_evidence))>0 AND rights_evidence IS NOT NULL))
);
CREATE UNIQUE INDEX source_registry_root_idx ON acquisition.source_registry(source_key) WHERE supersedes_id IS NULL;
CREATE FUNCTION acquisition.validate_source_successor() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS(SELECT FROM acquisition.source_registry previous
  WHERE previous.id=NEW.supersedes_id AND previous.source_key=NEW.source_key AND previous.valid_from<=NEW.valid_from) THEN
  RAISE EXCEPTION 'source successor requires same source and chronological validity' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_source_successor BEFORE INSERT ON acquisition.source_registry FOR EACH ROW EXECUTE FUNCTION acquisition.validate_source_successor();

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
CREATE INDEX municipality_predecessor_idx ON acquisition.municipalities USING gin(predecessor_ids);
CREATE INDEX municipality_successor_idx ON acquisition.municipalities USING gin(successor_ids);
-- Deferred checks run at COMMIT under the caller, outside a writer function's
-- definer context. These private read-only constraint checks need owner access
-- to the full graph; never solve this by granting table reads to worker/API roles.
CREATE FUNCTION acquisition.validate_municipal_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE affected uuid;
BEGIN
 affected:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
 IF EXISTS(SELECT FROM acquisition.municipalities m
  WHERE (m.id=affected OR m.predecessor_ids @> ARRAY[affected] OR m.successor_ids @> ARRAY[affected])
  AND (cardinality(m.predecessor_ids)>100 OR cardinality(m.successor_ids)>100
   OR cardinality(m.predecessor_ids)<>(SELECT count(DISTINCT id) FROM unnest(m.predecessor_ids) id)
   OR cardinality(m.successor_ids)<>(SELECT count(DISTINCT id) FROM unnest(m.successor_ids) id)
   OR EXISTS(SELECT FROM unnest(m.predecessor_ids) e(predecessor) WHERE NOT EXISTS(
    SELECT FROM acquisition.municipalities p WHERE p.id=e.predecessor AND p.country=m.country
     AND p.valid_from<m.valid_from AND p.valid_until IS NOT NULL AND p.valid_until<=m.valid_from))
   OR EXISTS(SELECT FROM unnest(m.successor_ids) e(successor) WHERE NOT EXISTS(
    SELECT FROM acquisition.municipalities s WHERE s.id=e.successor AND s.country=m.country
     AND m.valid_until IS NOT NULL AND s.valid_from>m.valid_from AND s.valid_from>=m.valid_until))
  )) THEN RAISE EXCEPTION 'invalid municipality history reference' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validate_municipal_history AFTER INSERT OR UPDATE OR DELETE ON acquisition.municipalities
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition.validate_municipal_history();

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
 automatic_theme_evidence jsonb NOT NULL DEFAULT '{}', -- term -> same-lodging observation UUID
 manual_theme_decisions jsonb NOT NULL DEFAULT '{}', -- term -> explicit true / false; missing = automatic
 effective_theme_keys text[] GENERATED ALWAYS AS
  (acquisition.effective_category_keys(automatic_theme_evidence,manual_theme_decisions)) STORED,
 CHECK(acquisition.valid_category_state(automatic_theme_evidence,manual_theme_decisions)),
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
  'acquisition_phone','email','website','person','business_relationship','theme','filter','activity','price','exchange_rate','correction')),
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

CREATE FUNCTION acquisition.calculate_price_eur(amount numeric,currency text,basis text,occupancy integer,nights integer,extras jsonb,fx numeric)
 RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result numeric; fee record; rate numeric;
BEGIN
 IF amount IS NULL OR amount<=0 OR amount>='Infinity'::numeric OR jsonb_typeof(extras) IS DISTINCT FROM 'object'
  OR currency IS NULL OR currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'invalid price input' USING ERRCODE='22023'; END IF;
 rate:=CASE WHEN currency='EUR' THEN 1 ELSE fx END;
 IF rate IS NULL OR rate<=0 OR rate>='Infinity'::numeric THEN RAISE EXCEPTION 'verified positive exchange rate required' USING ERRCODE='22023'; END IF;
 IF basis IS NULL OR basis NOT IN('person_night','unit_night','person_stay','unit_stay')
  OR (basis IN('unit_night','unit_stay') AND (occupancy IS NULL OR occupancy<=0))
  OR (basis IN('person_stay','unit_stay') AND (nights IS NULL OR nights<=0)) THEN
  RAISE EXCEPTION 'known price basis and required occupancy/nights required' USING ERRCODE='22023';
 END IF;
 result:=amount / CASE WHEN basis IN('unit_night','unit_stay') THEN occupancy ELSE 1 END
  / CASE WHEN basis IN('person_stay','unit_stay') THEN nights ELSE 1 END;
 FOR fee IN SELECT * FROM jsonb_each(extras) LOOP
  IF fee.key NOT IN('person_night','unit_night','person_stay','unit_stay') OR jsonb_typeof(fee.value)<>'number'
   OR (fee.value#>>'{}')::numeric<0 OR (fee.value#>>'{}')::numeric>='Infinity'::numeric
   OR (fee.key IN('unit_night','unit_stay') AND (occupancy IS NULL OR occupancy<=0))
   OR (fee.key IN('person_stay','unit_stay') AND (nights IS NULL OR nights<=0)) THEN
   RAISE EXCEPTION 'mandatory extras require numeric amounts and their actual price basis' USING ERRCODE='22023';
  END IF;
  result:=result+(fee.value#>>'{}')::numeric
   / CASE WHEN fee.key IN('unit_night','unit_stay') THEN occupancy ELSE 1 END
   / CASE WHEN fee.key IN('person_stay','unit_stay') THEN nights ELSE 1 END;
 END LOOP;
 -- Preserve the unrounded comparison value: rounding must not make 200.004
 -- appear to qualify for the inclusive 200 EUR rule.
 RETURN result*rate;
END;
$$;
CREATE FUNCTION acquisition.validate_price_comparison() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE calculated numeric;
BEGIN
 IF NOT EXISTS(SELECT FROM acquisition.observations o WHERE o.id=NEW.observation_id
  AND o.accommodation_id=NEW.accommodation_id AND o.fact_type='price') THEN
  RAISE EXCEPTION 'price observation requires price evidence' USING ERRCODE='23514';
 END IF;
 IF NEW.eur_per_person_night IS NOT NULL THEN
  IF NOT EXISTS(SELECT FROM acquisition.observations o WHERE o.id=NEW.observation_id AND o.review_status='verified')
   OR (NEW.currency<>'EUR' AND NOT EXISTS(SELECT FROM acquisition.observations o WHERE o.id=NEW.exchange_rate_observation_id
    AND o.accommodation_id=NEW.accommodation_id AND o.fact_type='exchange_rate' AND o.review_status='verified')) THEN
   RAISE EXCEPTION 'comparison requires verified price and exchange evidence' USING ERRCODE='23514';
  END IF;
  calculated:=acquisition.calculate_price_eur(NEW.original_amount,NEW.currency,NEW.basis,NEW.occupancy,NEW.nights,NEW.mandatory_extras,NEW.exchange_rate);
  IF NEW.eur_per_person_night<>calculated THEN RAISE EXCEPTION 'comparison does not match original price and mandatory extras' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_price_comparison BEFORE INSERT ON acquisition.price_observations FOR EACH ROW EXECUTE FUNCTION acquisition.validate_price_comparison();

CREATE TABLE acquisition.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 accommodation_id uuid REFERENCES acquisition.accommodations(id),
 candidate_reference varchar(500),
 run_id uuid REFERENCES acquisition.processing_runs(id),
 actor text NOT NULL CHECK(length(btrim(actor))>0),
 actor_user_id uuid, -- obtained from verified auth.uid(), not caller input; survives account deletion
 event_type varchar(100) NOT NULL,
 changed_fields text[] NOT NULL DEFAULT '{}',
 old_revision bigint CHECK(old_revision>0),
 new_revision bigint CHECK(new_revision>0),
 reason varchar(4000),
 rule_version varchar(100),
 fingerprint text CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 before_values jsonb CHECK(before_values IS NULL OR (jsonb_typeof(before_values)='object' AND octet_length(before_values::text)<=8192)),
 after_values jsonb CHECK(after_values IS NULL OR (jsonb_typeof(after_values)='object' AND octet_length(after_values::text)<=8192)),
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

CREATE FUNCTION acquisition.valid_category_evidence(p_id uuid,p_evidence jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT FROM jsonb_each_text(p_evidence) e WHERE NOT EXISTS(
  SELECT FROM acquisition.observations o JOIN acquisition.source_registry s ON s.id=o.source_id
  WHERE o.id=e.value::uuid AND o.accommodation_id=p_id AND o.fact_type='theme' AND o.term_key=e.key
   AND o.review_status='verified' AND o.checked_at IS NOT NULL
   AND s.research_right='allowed' AND s.extraction_right='allowed'
   AND 'travel_categories'=ANY(s.allowed_fields) AND s.valid_from<=statement_timestamp()
   AND (s.valid_until IS NULL OR s.valid_until>statement_timestamp())
   AND NOT EXISTS(SELECT FROM acquisition.source_registry successor WHERE successor.supersedes_id=s.id AND successor.valid_from<=statement_timestamp())
 ));
$$;

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
 IF TG_OP='INSERT' OR NEW.automatic_theme_evidence IS DISTINCT FROM OLD.automatic_theme_evidence THEN
  IF NOT acquisition.valid_category_state(NEW.automatic_theme_evidence,NEW.manual_theme_decisions) THEN
   RAISE EXCEPTION 'invalid category state' USING ERRCODE='22023';
  END IF;
  IF NOT acquisition.valid_category_evidence(NEW.id,NEW.automatic_theme_evidence) THEN
   RAISE EXCEPTION 'category requires current permitted same-lodging evidence' USING ERRCODE='23514';
  END IF;
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

CREATE FUNCTION acquisition.validate_current_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a acquisition.accommodations;
BEGIN
 SELECT * INTO a FROM acquisition.accommodations WHERE id=NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT FROM (VALUES
  (a.location_observation_id,'location'),(a.phone_observation_id,'phone'),(a.operator_observation_id,'operator'),
  (a.company_address_observation_id,'company_address'),(a.acquisition_phone_observation_id,'acquisition_phone'),
  (a.email_observation_id,'email'),(a.website_observation_id,'website'),(a.person_observation_id,'person'),
  (a.business_relationship_observation_id,'business_relationship')) expected(observation_id,fact_type)
  WHERE expected.observation_id IS NOT NULL AND NOT EXISTS(
   SELECT FROM acquisition.observations o WHERE o.id=expected.observation_id AND o.accommodation_id=a.id AND o.fact_type=expected.fact_type
  )) THEN RAISE EXCEPTION 'current value requires matching evidence type' USING ERRCODE='23514'; END IF;
 IF a.acquisition_status='premium_customer' AND NOT EXISTS(
  SELECT FROM acquisition.observations o WHERE o.id=a.business_relationship_observation_id AND o.accommodation_id=a.id
   AND o.fact_type='business_relationship' AND o.review_status='verified' AND o.facts->'confirmed'='true'::jsonb
 ) THEN RAISE EXCEPTION 'confirmed business relationship required' USING ERRCODE='23514'; END IF;
 IF a.last_import_run_id IS NOT NULL AND NOT EXISTS(SELECT FROM acquisition.processing_runs r WHERE r.id=a.last_import_run_id
  AND r.run_type IN('import','refresh') AND r.status IN('succeeded','partial') AND r.imported>0
  AND a.last_import_at>=r.started_at AND a.last_import_at<=r.finished_at)
 THEN RAISE EXCEPTION 'actual successful import run required' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER validate_current_evidence AFTER INSERT OR UPDATE ON acquisition.accommodations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION acquisition.validate_current_evidence();

-- Final transaction state must be a direct canonical link, never a chain.
-- Multi-session identity merges still require the later ordered-lock procedure;
-- there is deliberately no importer/merge privilege in this foundation.
CREATE FUNCTION acquisition.check_canonical_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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

-- Derived on demand so expiry and a change in current evidence cannot leave a
-- stale writable licence-summary column behind. No public grants or projection.
CREATE FUNCTION acquisition.source_use_summary(p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SET search_path='' AS $$
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
$$;

-- Private building blocks for the later Admin integration. No API-role grants,
-- wrappers or UI in this proposal. A database-owner call is still admin-checked.
CREATE FUNCTION acquisition.read_basic_categories(p_id uuid) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a acquisition.accommodations;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_review_travel_profiles() THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 SELECT * INTO a FROM acquisition.accommodations WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'basic accommodation not found' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('id',a.id,'name',a.name,'city',a.city,'country',a.country,'revision',a.revision,
  'assignedKeys',a.effective_theme_keys,'manualDecisions',a.manual_theme_decisions,
  'automaticKeys',ARRAY(SELECT jsonb_object_keys(a.automatic_theme_evidence) ORDER BY 1),
  'terms',coalesce((SELECT jsonb_agg(jsonb_build_object('term_key',term_key,'label',label,'dimension',dimension) ORDER BY label,term_key)
   FROM public.travel_terms WHERE term_key=ANY(acquisition.basic_theme_keys()) AND dimension='theme'),'[]'::jsonb));
END;
$$;

CREATE FUNCTION acquisition.save_basic_categories(p_id uuid,p_expected_revision bigint,p_selected text[],p_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a acquisition.accommodations; selected text[]; decisions jsonb; category_key text; actor_id uuid;
BEGIN
 actor_id:=auth.uid();
 IF actor_id IS NULL OR NOT public.can_review_travel_profiles() THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<1 OR p_selected IS NULL OR cardinality(p_selected)>11
  OR array_ndims(p_selected)>1 OR EXISTS(SELECT FROM unnest(p_selected) k WHERE k IS NULL OR NOT(k=ANY(acquisition.basic_theme_keys())))
  OR EXISTS(SELECT FROM unnest(p_selected) k WHERE NOT EXISTS(SELECT FROM public.travel_terms WHERE term_key=k AND dimension='theme'))
  OR (SELECT count(*) FROM unnest(p_selected))<>(SELECT count(DISTINCT k) FROM unnest(p_selected) k)
 THEN RAISE EXCEPTION 'invalid category selection' USING ERRCODE='22023'; END IF;
 SELECT * INTO a FROM acquisition.accommodations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'basic accommodation not found' USING ERRCODE='P0002'; END IF;
 IF a.revision<>p_expected_revision THEN RAISE EXCEPTION 'accommodation changed; reload' USING ERRCODE='40001'; END IF;
 SELECT coalesce(array_agg(k ORDER BY k),'{}'::text[]) INTO selected FROM unnest(p_selected) k;
 IF a.effective_theme_keys=selected THEN RETURN acquisition.read_basic_categories(p_id); END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN
  RAISE EXCEPTION 'category decision requires reason' USING ERRCODE='22023';
 END IF;
 decisions:=a.manual_theme_decisions;
 FOREACH category_key IN ARRAY acquisition.basic_theme_keys() LOOP
  IF (category_key=ANY(selected)) IS DISTINCT FROM (category_key=ANY(a.effective_theme_keys)) THEN
   decisions:=decisions||jsonb_build_object(category_key,category_key=ANY(selected));
  END IF;
 END LOOP;
 UPDATE acquisition.accommodations SET manual_theme_decisions=decisions WHERE id=p_id;
 INSERT INTO acquisition.audit_events(accommodation_id,actor,actor_user_id,event_type,changed_fields,old_revision,new_revision,reason,before_values,after_values)
 VALUES(p_id,'portal_admin',actor_id,'basic_categories_admin',ARRAY['manual_theme_decisions','effective_theme_keys'],a.revision,a.revision+1,btrim(p_reason),
  jsonb_build_object('manual',a.manual_theme_decisions,'effective',a.effective_theme_keys),
  jsonb_build_object('manual',decisions,'effective',acquisition.effective_category_keys(a.automatic_theme_evidence,decisions)));
 RETURN acquisition.read_basic_categories(p_id);
END;
$$;

CREATE FUNCTION acquisition.refresh_basic_category_basis(p_id uuid,p_expected_revision bigint,p_evidence jsonb,p_run_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a acquisition.accommodations; worker_run acquisition.processing_runs;
BEGIN
 IF p_expected_revision IS NULL OR p_expected_revision<1 OR p_evidence IS NULL
  OR NOT acquisition.valid_category_state(p_evidence,'{}') THEN
  RAISE EXCEPTION 'invalid automatic category basis' USING ERRCODE='22023';
 END IF;
 SELECT * INTO worker_run FROM acquisition.processing_runs WHERE id=p_run_id;
 IF NOT FOUND OR worker_run.status<>'running' OR worker_run.run_type NOT IN('import','refresh') THEN
  RAISE EXCEPTION 'active import or refresh run required' USING ERRCODE='22023';
 END IF;
 SELECT * INTO a FROM acquisition.accommodations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'basic accommodation not found' USING ERRCODE='P0002'; END IF;
 IF a.revision<>p_expected_revision THEN RAISE EXCEPTION 'accommodation changed; reload' USING ERRCODE='40001'; END IF;
 IF NOT acquisition.valid_category_evidence(p_id,p_evidence) THEN
  RAISE EXCEPTION 'current permitted category evidence required' USING ERRCODE='23514';
 END IF;
 IF a.automatic_theme_evidence=p_evidence THEN
  RETURN jsonb_build_object('id',a.id,'revision',a.revision,'assignedKeys',a.effective_theme_keys);
 END IF;
 UPDATE acquisition.accommodations SET automatic_theme_evidence=p_evidence WHERE id=p_id;
 INSERT INTO acquisition.audit_events(accommodation_id,run_id,actor,event_type,changed_fields,old_revision,new_revision,before_values,after_values)
 VALUES(p_id,p_run_id,session_user,'basic_categories_automatic',ARRAY['automatic_theme_evidence','effective_theme_keys'],a.revision,a.revision+1,
  jsonb_build_object('automatic',a.automatic_theme_evidence,'effective',a.effective_theme_keys),
  jsonb_build_object('automatic',p_evidence,'effective',acquisition.effective_category_keys(p_evidence,a.manual_theme_decisions)));
 RETURN jsonb_build_object('id',p_id,'revision',a.revision+1,'assignedKeys',acquisition.effective_category_keys(p_evidence,a.manual_theme_decisions));
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA acquisition TO acquisition_category_importer;
GRANT EXECUTE ON FUNCTION acquisition.refresh_basic_category_basis(uuid,bigint,jsonb,uuid) TO acquisition_category_importer;
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
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='acquisition' AND (has_function_privilege('anon',p.oid,'EXECUTE')
   OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
  RAISE EXCEPTION 'unexpected acquisition function grant';
 END IF;
END $$;
COMMIT;
