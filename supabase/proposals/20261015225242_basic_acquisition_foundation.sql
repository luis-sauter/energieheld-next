-- PROPOSAL ONLY. Not in supabase/migrations and not approved for Cloud use.
-- Foundation, not a complete search/publication rollout. No seed or existing-row changes.
BEGIN;
CREATE SCHEMA acquisition;
REVOKE ALL ON SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA acquisition REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE acquisition.operators (
 id uuid PRIMARY KEY,
 legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 1 AND 300),
 external_identifiers jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(external_identifiers)='object'),
 verified_at timestamptz
);
CREATE TABLE acquisition.municipalities (
 id text PRIMARY KEY, -- e.g. DE:AGS:09277113; never a name alone
 country text NOT NULL CHECK(country IN('DE','AT','CH','IT')),
 official_code text NOT NULL,
 name text NOT NULL,
 region text NOT NULL,
 source_url text NOT NULL CHECK(source_url ~ '^https?://'),
 UNIQUE(country,official_code)
);
CREATE TABLE acquisition.research_runs (
 id uuid PRIMARY KEY,
 municipality_id text NOT NULL REFERENCES acquisition.municipalities(id),
 researched_at timestamptz NOT NULL,
 sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array'),
 candidates integer NOT NULL CHECK(candidates>=0),
 verified integer NOT NULL CHECK(verified>=0 AND verified<=candidates),
 gaps jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(gaps)='array'),
 coverage_status text NOT NULL CHECK(coverage_status IN('sample','partial','reviewed')),
 next_review_at timestamptz
);
CREATE TABLE acquisition.accommodation_identities (
 id uuid PRIMARY KEY,
 canonical_key text NOT NULL UNIQUE,
 name text NOT NULL,
 accommodation_type text,
 operator_id uuid REFERENCES acquisition.operators(id),
 municipality_id text NOT NULL REFERENCES acquisition.municipalities(id),
 address jsonb NOT NULL CHECK(jsonb_typeof(address)='object'),
 existing_profile_id uuid UNIQUE REFERENCES public.company_profiles(id) ON DELETE RESTRICT,
 active_verified_at timestamptz,
 identity_review text NOT NULL DEFAULT 'pending' CHECK(identity_review IN('pending','verified','ambiguous','closed'))
);
CREATE INDEX accommodation_operator_idx ON acquisition.accommodation_identities(operator_id) WHERE operator_id IS NOT NULL;
CREATE INDEX accommodation_municipality_idx ON acquisition.accommodation_identities(municipality_id,id);
CREATE TABLE acquisition.research_details (
 identity_id uuid PRIMARY KEY REFERENCES acquisition.accommodation_identities(id) ON DELETE RESTRICT,
 official_website text,
 contact_page text,
 imprint_page text,
 business_phone text,
 business_email text,
 contact_form text,
 contact_person text,
 contact_role text,
 primary_theme text REFERENCES public.travel_terms(term_key),
 missing_fields jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(missing_fields)='array'),
 review_status text NOT NULL DEFAULT 'pending',
 duplicate_status text NOT NULL DEFAULT 'pending',
 import_status text NOT NULL DEFAULT 'local_only',
 acquisition_status text NOT NULL DEFAULT 'not_contacted',
 marketing_permission text NOT NULL DEFAULT 'not_established',
 retention_review_at timestamptz NOT NULL,
 checked_at timestamptz NOT NULL,
 payload_fingerprint text NOT NULL CHECK(payload_fingerprint ~ '^[a-f0-9]{64}$')
);
CREATE TABLE acquisition.sources (
 id uuid PRIMARY KEY,
 identity_id uuid NOT NULL REFERENCES acquisition.accommodation_identities(id) ON DELETE RESTRICT,
 run_id uuid NOT NULL REFERENCES acquisition.research_runs(id) ON DELETE RESTRICT,
 provider text NOT NULL,
 source_record_id text,
 url text NOT NULL CHECK(url ~ '^https?://'),
 checked_at timestamptz NOT NULL,
 claim text NOT NULL CHECK(length(claim)<=500), -- brief facts; no copied website or images
 content_fingerprint text,
 UNIQUE(id,identity_id)
);
CREATE UNIQUE INDEX source_observation_idx ON acquisition.sources(provider,source_record_id,checked_at) WHERE source_record_id IS NOT NULL;
CREATE INDEX source_external_identity_idx ON acquisition.sources(provider,source_record_id) WHERE source_record_id IS NOT NULL;
CREATE INDEX source_identity_idx ON acquisition.sources(identity_id,checked_at DESC);
CREATE TABLE acquisition.theme_evidence (
 identity_id uuid NOT NULL REFERENCES acquisition.accommodation_identities(id),
 term_key text NOT NULL REFERENCES public.travel_terms(term_key),
 source_id uuid NOT NULL,
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 1 AND 500),
 PRIMARY KEY(identity_id,term_key,source_id),
 FOREIGN KEY(source_id,identity_id) REFERENCES acquisition.sources(id,identity_id)
);
CREATE INDEX theme_evidence_filter_idx ON acquisition.theme_evidence(term_key,identity_id);
CREATE TABLE acquisition.price_observations (
 id uuid PRIMARY KEY,
 identity_id uuid NOT NULL REFERENCES acquisition.accommodation_identities(id),
 source_id uuid NOT NULL,
 original_amount numeric(12,2) NOT NULL CHECK(original_amount>0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 price_basis text NOT NULL CHECK(price_basis IN('person_night','unit_night','stay','unknown')),
 occupancy integer CHECK(occupancy>0),
 nights integer CHECK(nights>0),
 travel_period text,
 board text,
 mandatory_extras jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(mandatory_extras)='object'),
 extras_verified boolean NOT NULL DEFAULT false,
 is_from_price boolean NOT NULL DEFAULT false,
 eur_per_person_night numeric(12,2) CHECK(eur_per_person_night>0),
 exchange_rate numeric,
 exchange_rate_at timestamptz,
 comparison_status text NOT NULL DEFAULT 'unverified',
 checked_at timestamptz NOT NULL,
 FOREIGN KEY(source_id,identity_id) REFERENCES acquisition.sources(id,identity_id),
 CHECK(currency='EUR' OR eur_per_person_night IS NULL OR (exchange_rate IS NOT NULL AND exchange_rate>0 AND exchange_rate_at IS NOT NULL))
);
CREATE INDEX price_identity_idx ON acquisition.price_observations(identity_id,checked_at DESC);

-- Published contact projection, not another company-management system.
-- Never write websites, emails, people, price/research/operator data here.
CREATE TABLE public.basic_accommodation_contacts (
 id uuid PRIMARY KEY REFERENCES acquisition.accommodation_identities(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 300),
 address jsonb NOT NULL CHECK(
   jsonb_typeof(address)='object' AND address - ARRAY['country','region','city','postalCode','street']='{}'::jsonb
   AND address ?& ARRAY['country','region','city','postalCode','street']
   AND jsonb_typeof(address->'country')='string' AND address->>'country' IN('DE','AT','CH','IT')
   AND jsonb_typeof(address->'region')='string' AND length(btrim(address->>'region'))>0
   AND jsonb_typeof(address->'city')='string' AND length(btrim(address->>'city'))>0
   AND jsonb_typeof(address->'postalCode')='string' AND length(btrim(address->>'postalCode'))>0
   AND jsonb_typeof(address->'street')='string' AND length(btrim(address->>'street'))>0
 ),
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','approved')),
 is_listed boolean NOT NULL DEFAULT false,
 search_vector tsvector GENERATED ALWAYS AS (
   to_tsvector('pg_catalog.german'::regconfig,name || ' ' || (address->>'city') || ' ' || (address->>'region') || ' ' || (address->>'postalCode') || ' ' || (address->>'street') || ' ' || phone)
 ) STORED
);
ALTER TABLE public.basic_accommodation_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.basic_accommodation_contacts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.basic_accommodation_contacts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT(id,name,address,phone) ON public.basic_accommodation_contacts TO anon,authenticated;
CREATE POLICY basic_contacts_public_read ON public.basic_accommodation_contacts FOR SELECT TO anon,authenticated USING(status='approved' AND is_listed);
CREATE INDEX basic_contacts_search_idx ON public.basic_accommodation_contacts USING gin(search_vector) WHERE status='approved' AND is_listed;
CREATE INDEX basic_contacts_name_idx ON public.basic_accommodation_contacts(lower(name),id) WHERE status='approved' AND is_listed;
CREATE INDEX basic_contacts_place_idx ON public.basic_accommodation_contacts((address->>'country'),(address->>'city'),id) WHERE status='approved' AND is_listed;

-- Existing profiles (including hidden/drafts) cannot gain a competing Basic.
CREATE FUNCTION acquisition.guard_basic_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND NEW.is_listed AND NOT EXISTS (
   SELECT 1 FROM acquisition.accommodation_identities i WHERE i.id=NEW.id AND i.existing_profile_id IS NULL AND i.identity_review='verified' AND i.active_verified_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'verified independent accommodation required'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_basic_contact BEFORE INSERT OR UPDATE ON public.basic_accommodation_contacts FOR EACH ROW EXECUTE FUNCTION acquisition.guard_basic_contact();
CREATE FUNCTION acquisition.hide_ineligible_basic_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.existing_profile_id IS NOT NULL OR NEW.identity_review<>'verified' OR NEW.active_verified_at IS NULL THEN
   UPDATE public.basic_accommodation_contacts SET status='draft',is_listed=false WHERE id=NEW.id AND (status<>'draft' OR is_listed);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER hide_ineligible_basic_contact AFTER UPDATE OF existing_profile_id,identity_review,active_verified_at ON acquisition.accommodation_identities FOR EACH ROW EXECUTE FUNCTION acquisition.hide_ineligible_basic_contact();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA acquisition FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['operators','municipalities','research_runs','accommodation_identities','research_details','sources','theme_evidence','price_observations'] LOOP
   EXECUTE format('ALTER TABLE acquisition.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE acquisition.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
COMMIT;
