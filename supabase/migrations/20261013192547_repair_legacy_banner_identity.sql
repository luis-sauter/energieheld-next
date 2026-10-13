-- Correct one proven legacy source identity; keep visibility, bookings and media intact.
BEGIN;
DO $repair$
DECLARE changed integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ad_banner_search_metadata
    WHERE banner_key = 'legacy:https://westerwald.info/'
      AND legacy_name = 'Westerwald'
      AND advertiser_key = 'domain:westerwald.info'
  ) THEN
    RAISE EXCEPTION 'Verified Westerwald identity missing; stop banner repair';
  END IF;

  UPDATE public.ad_legacy_banner_search_sources
  SET banner_key = 'legacy:https://westerwald.info/',
      target_url = 'https://www.westerwald.info/'
  WHERE path = '/mottoreisen/natur-pur'
    AND placement = 'sidebar_08'
    AND banner_key = 'legacy:https://ostseehotel-dierhagen.de/de/home'
    AND target_url = 'https://www.ostseehotel-dierhagen.de/de/home';

  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 1 THEN
    RAISE EXCEPTION 'Legacy source changed since audit; stop banner repair';
  END IF;
END;
$repair$;
COMMIT;
