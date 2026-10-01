-- Correct the confirmed historical A–D basis on A–Z only.
-- Future reordering changes display_source, never the legacy basis or booking targets.
BEGIN;
UPDATE public.ad_slot_presentations
SET display_source = placement,
    legacy_placement = placement,
    size = CASE WHEN placement = 'sidebar_top' THEN 'large' ELSE 'small' END,
    legacy_hidden = false
WHERE target_type = 'experts_directory'
  AND target_key IS NULL
  AND placement IN ('sidebar_top', 'sidebar_middle', 'sidebar_bottom', 'sidebar_04');
COMMIT;
