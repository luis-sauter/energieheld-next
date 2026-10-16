-- REVIEW ONLY. Requires separate approval. No seed or automatic worker grant.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
-- Replace inactive placeholders with enforceable publication invariants.
ALTER TABLE acquisition.accommodations DROP CONSTRAINT foundation_publication_inactive;
ALTER TABLE acquisition.accommodations ADD CONSTRAINT basic_publication_reviewed CHECK(
 visibility_status<>'public' OR(approval_status='approved' AND approval_event_id IS NOT NULL AND approved_rule_version IS NOT NULL
 AND approved_fingerprint IS NOT NULL AND published_at IS NOT NULL AND existing_profile_id IS NULL AND NOT had_profile_link
 AND canonical_accommodation_id IS NULL AND publication_block IS NULL AND identity_status='clear' AND contact_status='checked'
 AND eligibility_status='eligible' AND activity_status IN('active','seasonal') AND cardinality(effective_theme_keys)>0
 AND name IS NOT NULL AND city IS NOT NULL AND region_name IS NOT NULL AND country IS NOT NULL AND phone IS NOT NULL
 AND municipality_id IS NOT NULL AND location_observation_id IS NOT NULL AND phone_observation_id IS NOT NULL
 AND checked_at IS NOT NULL AND(price_status='qualifying' OR price_exception_event_id IS NOT NULL)));
ALTER TABLE public.basic_accommodation_contacts DROP CONSTRAINT foundation_listing_inactive;

-- A disqualifying change withdraws an existing Basic reversibly. It never
-- publishes or clears a hold, including when a profile is later deleted.
CREATE FUNCTION acquisition.withdraw_changed_basic() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.visibility_status='public' AND NEW.visibility_status='public' AND(
  NEW.existing_profile_id IS NOT NULL OR NEW.had_profile_link OR NEW.canonical_accommodation_id IS NOT NULL
  OR NEW.publication_block IS NOT NULL OR NEW.identity_status<>'clear' OR NEW.contact_status<>'checked'
  OR NEW.activity_status NOT IN('active','seasonal') OR NEW.eligibility_status<>'eligible' OR NEW.approval_status<>'approved'
  OR cardinality(acquisition.effective_category_keys(NEW.automatic_theme_evidence,NEW.manual_theme_decisions))=0
  OR (NEW.name,NEW.phone,NEW.street,NEW.house_number,NEW.postal_code,NEW.city,NEW.region_name,NEW.country)
   IS DISTINCT FROM(OLD.name,OLD.phone,OLD.street,OLD.house_number,OLD.postal_code,OLD.city,OLD.region_name,OLD.country)
  OR acquisition.source_use_summary(OLD.id)->>'publication' IS DISTINCT FROM 'allowed') THEN
  NEW.visibility_status:='withdrawn';NEW.approval_status:='needs_review';NEW.withdrawn_at:=clock_timestamp();
  NEW.withdrawal_reason:='data_or_category_change';NEW.withdrawal_note:='Vorherige Basic-Freigabe erneut prüfen.';
  NEW.publication_block:=coalesce(NEW.publication_block,'data_conflict');
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER aaa_withdraw_changed_basic BEFORE UPDATE ON acquisition.accommodations
 FOR EACH ROW EXECUTE FUNCTION acquisition.withdraw_changed_basic();

CREATE FUNCTION acquisition.basic_contact_fingerprint(a acquisition.accommodations) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('name',a.name,'phone',a.phone,'address',jsonb_build_object(
 'street',a.street,'houseNumber',a.house_number,'postalCode',a.postal_code,'city',a.city,'region',a.region_name,'country',a.country))::text,'UTF8')),'hex');
$$;
CREATE FUNCTION acquisition.guard_basic_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a acquisition.accommodations; event acquisition.audit_events;
BEGIN
 IF NOT NEW.is_listed THEN RETURN NEW; END IF;
 SELECT * INTO a FROM acquisition.accommodations WHERE id=NEW.id FOR SHARE;
 SELECT * INTO event FROM acquisition.audit_events WHERE id=a.approval_event_id AND accommodation_id=a.id;
 IF a.id IS NULL OR a.visibility_status<>'public' OR a.approval_status<>'approved' OR a.publication_block IS NOT NULL
  OR a.existing_profile_id IS NOT NULL OR a.had_profile_link OR a.canonical_accommodation_id IS NOT NULL
  OR a.identity_status<>'clear' OR a.contact_status<>'checked' OR a.activity_status NOT IN('active','seasonal')
  OR a.eligibility_status<>'eligible' OR cardinality(a.effective_theme_keys)=0
  OR a.approved_fingerprint IS DISTINCT FROM acquisition.basic_contact_fingerprint(a)
  OR NEW.name IS DISTINCT FROM a.name OR NEW.phone IS DISTINCT FROM a.phone
  OR NEW.address IS DISTINCT FROM jsonb_strip_nulls(jsonb_build_object('street',a.street,'houseNumber',a.house_number,
   'postalCode',a.postal_code,'city',a.city,'region',a.region_name,'country',a.country))
  OR NEW.filter_keys IS DISTINCT FROM a.effective_theme_keys OR NEW.accommodation_type IS DISTINCT FROM a.accommodation_type
  OR NEW.rights_valid_until IS DISTINCT FROM(SELECT min(s.valid_until) FROM acquisition.observations o JOIN acquisition.source_registry s ON s.id=o.source_id
   WHERE o.accommodation_id=a.id AND(o.id IN(a.primary_observation_id,a.location_observation_id,a.phone_observation_id)
    OR o.id IN(SELECT value::uuid FROM jsonb_each_text(a.automatic_theme_evidence))))
  OR event.event_type IS DISTINCT FROM 'reviewed_pilot_publication' OR event.fingerprint IS DISTINCT FROM a.approved_fingerprint
  OR event.after_values->>'rule' IS DISTINCT FROM a.approved_rule_version OR nullif(btrim(event.reason),'') IS NULL
  OR acquisition.source_use_summary(a.id)->>'publication' IS DISTINCT FROM 'allowed'
  OR acquisition.source_use_summary(a.id)->>'research' IS DISTINCT FROM 'allowed'
  OR acquisition.source_use_summary(a.id)->>'extraction' IS DISTINCT FROM 'allowed'
  OR NOT(EXISTS(SELECT FROM acquisition.audit_events e WHERE e.id=a.price_exception_event_id AND e.accommodation_id=a.id
    AND e.event_type='price_exception' AND e.after_values->'approved'='true'::jsonb AND length(btrim(e.reason))>0) OR EXISTS(SELECT FROM acquisition.price_observations p
    WHERE p.accommodation_id=a.id AND p.comparison_status='comparable' AND p.eur_per_person_night<=200))
 THEN RAISE EXCEPTION 'contact projection lacks verified publication decision' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER guard_basic_projection BEFORE INSERT OR UPDATE ON public.basic_accommodation_contacts
 FOR EACH ROW EXECUTE FUNCTION acquisition.guard_basic_projection();
REVOKE ALL ON FUNCTION acquisition.basic_contact_fingerprint(acquisition.accommodations),acquisition.guard_basic_projection()
 FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;
REVOKE ALL ON FUNCTION acquisition.withdraw_changed_basic() FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;
CREATE FUNCTION acquisition.withdraw_superseded_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.supersedes_id IS NOT NULL THEN
  UPDATE public.basic_accommodation_contacts b SET is_listed=false WHERE b.is_listed AND EXISTS(
   SELECT FROM acquisition.observations o WHERE o.accommodation_id=b.id AND o.source_key=NEW.source_key);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER withdraw_superseded_source AFTER INSERT ON acquisition.source_registry FOR EACH ROW EXECUTE FUNCTION acquisition.withdraw_superseded_source();
REVOKE ALL ON FUNCTION acquisition.withdraw_superseded_source() FROM PUBLIC,anon,authenticated,service_role,acquisition_category_importer;
-- No function can publish from an API role. An exact separately approved owner
-- transaction must supply the reviewed pilot rows, evidence and audit decision.
COMMIT;

