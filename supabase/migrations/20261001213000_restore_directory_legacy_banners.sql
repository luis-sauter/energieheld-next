-- Restore only the ten proven pre-reconciliation A–Z sidebar creatives.
-- Retain all stored content/display permutations, sizes, URLs and booking data.
BEGIN;
UPDATE public.ad_slot_presentations
SET legacy_hidden = false
WHERE target_type = 'experts_directory'
  AND target_key IS NULL
  AND placement <> 'top_banner'
  AND legacy_hidden
  AND coalesce(legacy_placement, placement) IN (
    'sidebar_top', 'sidebar_middle', 'sidebar_bottom', 'sidebar_04', 'sidebar_05',
    'sidebar_06', 'sidebar_07', 'sidebar_08', 'sidebar_09', 'sidebar_10'
  );
COMMIT;
