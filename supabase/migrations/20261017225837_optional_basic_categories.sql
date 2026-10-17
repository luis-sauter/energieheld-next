-- Explicit user approval: a Basic needs no mandatory travel theme.
-- Preserve audience composition, rights, decisions, price and identity guards.
-- No seed, publication, row update, grant or RLS change.
BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='15s';
DO $optional_themes$
DECLARE definition text; replacement text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint
 WHERE conrelid='acquisition.accommodations'::regclass AND conname='basic_publication_reviewed';
 IF definition IS NULL OR position(' AND (cardinality(effective_theme_keys) > 0)' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected Basic publication constraint; review before changing';
 END IF;
 replacement:=replace(definition,' AND (cardinality(effective_theme_keys) > 0)','');
 ALTER TABLE acquisition.accommodations DROP CONSTRAINT basic_publication_reviewed;
 EXECUTE 'ALTER TABLE acquisition.accommodations ADD CONSTRAINT basic_publication_reviewed '||replacement;

 definition:=pg_get_functiondef('acquisition.sync_basic_contact()'::regprocedure);
 IF position('filter_keys=acquisition.basic_filter_keys(NEW)' in definition)=0
  OR position('AND cardinality(NEW.effective_theme_keys)>0' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected Basic sync; audience filters must be preserved';
 END IF;
 EXECUTE replace(definition,'AND cardinality(NEW.effective_theme_keys)>0','');

 definition:=pg_get_functiondef('acquisition.withdraw_changed_basic()'::regprocedure);
 IF position('OR cardinality(acquisition.effective_category_keys(NEW.automatic_theme_evidence,NEW.manual_theme_decisions))=0' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected Basic withdrawal guard';
 END IF;
 EXECUTE replace(definition,'OR cardinality(acquisition.effective_category_keys(NEW.automatic_theme_evidence,NEW.manual_theme_decisions))=0','');

 definition:=pg_get_functiondef('acquisition.guard_basic_projection()'::regprocedure);
 IF position('OR cardinality(a.effective_theme_keys)=0' in definition)=0
  OR position('acquisition.basic_filter_keys(a)' in definition)=0
  OR position('a.approved_filter_evidence' in definition)=0 THEN
  RAISE EXCEPTION 'Unexpected Basic projection guard; audience rights must be preserved';
 END IF;
 EXECUTE replace(definition,'OR cardinality(a.effective_theme_keys)=0','');
END $optional_themes$;
COMMIT;
