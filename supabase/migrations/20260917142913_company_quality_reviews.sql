-- Repository only. Independent of publication, categories, advertising and ranking.
CREATE TABLE public.company_quality_reviews (
 profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 status text NOT NULL CHECK (status IN ('verified')),
 verified_at timestamptz NOT NULL,
 -- Die Verifizierung bleibt erhalten, wenn der Prüfer-Account später gelöscht wird.
 verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 public_note text CHECK (public_note IS NULL OR char_length(public_note) <= 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_quality_reviews_verifier_idx ON public.company_quality_reviews(verified_by);
ALTER TABLE public.company_quality_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_quality_reviews FROM PUBLIC, anon, authenticated;
-- The verifier's identity is private. Only these presentation fields are exposed.
GRANT SELECT (profile_id,status,verified_at,public_note) ON public.company_quality_reviews TO anon, authenticated;
CREATE POLICY quality_public_read ON public.company_quality_reviews FOR SELECT TO anon, authenticated USING (
 EXISTS (SELECT 1 FROM public.company_profiles p WHERE p.id=profile_id AND p.status='approved')
);
CREATE POLICY quality_owner_read ON public.company_quality_reviews FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY quality_admin_read ON public.company_quality_reviews FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid()))
);
-- No direct write grants or write policies, including for admins: mutation uses RPCs.
CREATE FUNCTION public.verify_company_profile(p_profile_id uuid,p_public_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); note text := nullif(btrim(p_public_note,E' \t\n\r'),'');
BEGIN
 IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=actor) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF char_length(note)>1000 THEN RAISE EXCEPTION 'invalid note'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.company_profiles WHERE id=p_profile_id) THEN RAISE EXCEPTION 'profile not found'; END IF;
 INSERT INTO public.company_quality_reviews(profile_id,status,verified_at,verified_by,public_note)
 VALUES(p_profile_id,'verified',clock_timestamp(),actor,note)
 ON CONFLICT(profile_id) DO UPDATE SET status='verified',verified_at=clock_timestamp(),verified_by=actor,public_note=note,updated_at=clock_timestamp();
END;
$$;
CREATE FUNCTION public.remove_company_verification(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 DELETE FROM public.company_quality_reviews WHERE profile_id=p_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_company_profile(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.remove_company_verification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_company_profile(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_verification(uuid) TO authenticated;
