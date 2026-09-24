-- Presentation metadata only. Existing images receive these defaults without
-- changing their paths, captions, order or parent block.
ALTER TABLE public.profile_content_block_images
  ADD COLUMN focus_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN focus_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN zoom numeric NOT NULL DEFAULT 1;

ALTER TABLE public.profile_content_block_images
  ADD CONSTRAINT profile_block_image_focus_x CHECK (
    focus_x BETWEEN 0 AND 100 AND focus_x * 10 = trunc(focus_x * 10)),
  ADD CONSTRAINT profile_block_image_focus_y CHECK (
    focus_y BETWEEN 0 AND 100 AND focus_y * 10 = trunc(focus_y * 10)),
  ADD CONSTRAINT profile_block_image_zoom CHECK (
    zoom BETWEEN 1 AND 3 AND zoom * 100 = trunc(zoom * 100));

-- Existing SELECT grants and admin UPDATE RLS remain in force.
GRANT UPDATE (focus_x, focus_y, zoom)
  ON public.profile_content_block_images TO authenticated;
