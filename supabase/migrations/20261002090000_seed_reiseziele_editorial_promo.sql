-- One portal-owned editorial promotion. No schema, grants, policies or existing rows change.
BEGIN;
DO $seed$
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_ad_campaign_targets t JOIN public.company_ad_campaigns c ON c.id=t.campaign_id
    WHERE t.target_type='portal_area' AND t.target_key='reiseziele' AND t.placement='top_banner'
      AND c.id<>'7f1c06f6-9946-4f0e-90bc-7fb9499ed010' AND c.status IN ('pending','approved','paused')
      AND c.requested_end_date>='2026-10-02') THEN
    RAISE EXCEPTION 'Unexpected existing Reiseziele Premium booking: stop';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='ad-media'
    AND name='campaigns/7f1c06f6-9946-4f0e-90bc-7fb9499ed010/creative/ee4dcb6a-2ccc-4c4a-9a83-9d278a80d010.webp') THEN
    RAISE EXCEPTION 'Upload the verified editorial creative first';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_ad_campaigns WHERE id='7f1c06f6-9946-4f0e-90bc-7fb9499ed010') THEN
    RAISE EXCEPTION 'Seed campaign already exists: verify instead of overwriting';
  END IF;
  INSERT INTO public.company_ad_campaigns(id,profile_id,is_editorial,internal_name,placement,
    requested_start_date,requested_end_date,approved_start_date,approved_end_date,
    headline,body_text,target_url,image_path,status,admin_note,reviewed_at)
  VALUES ('7f1c06f6-9946-4f0e-90bc-7fb9499ed010',NULL,true,'Portal-Reiseinspiration Südtirol','top_banner',
    '2026-10-02','9999-12-31','2026-10-02','9999-12-31',
    'Südtirol – Natur, Genuss und unvergessliche Momente',
    'Grüne Almwiesen, sonnige Bergwege und alpine Ausblicke: Entdecken Sie Südtirol und passende Gastgeber für Ihre nächste Auszeit.',
    'https://das-reiseportal.com/reiseziele/suedtirol-italien',
    'campaigns/7f1c06f6-9946-4f0e-90bc-7fb9499ed010/creative/ee4dcb6a-2ccc-4c4a-9a83-9d278a80d010.webp',
    'approved','Portal-eigene redaktionelle Reiseinspiration, kein Werbekunde. Freigegeben durch Auftrag Louis.',now());
  INSERT INTO public.company_ad_campaign_targets(campaign_id,target_type,target_key,placement)
  VALUES ('7f1c06f6-9946-4f0e-90bc-7fb9499ed010','portal_area','reiseziele','top_banner');
END;
$seed$;
COMMIT;
