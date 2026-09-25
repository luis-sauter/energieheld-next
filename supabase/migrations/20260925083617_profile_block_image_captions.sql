ALTER TABLE public.profile_content_block_images
  ADD COLUMN caption text,
  ADD CONSTRAINT profile_block_image_caption_length
    CHECK (caption IS NULL OR char_length(caption) <= 500);

-- Preserve existing editorial descriptions as visible captions without changing image identity or presentation.
UPDATE public.profile_content_block_images
  SET caption = alt_text
  WHERE alt_text IS NOT NULL;

GRANT SELECT (caption) ON public.profile_content_block_images TO anon, authenticated;
GRANT UPDATE (caption) ON public.profile_content_block_images TO authenticated;
