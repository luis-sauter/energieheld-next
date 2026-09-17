-- Repository only: private requests are independent of publication and the public seal.
CREATE TABLE public.company_quality_requests (
 profile_id uuid PRIMARY KEY REFERENCES public.company_profiles(id) ON DELETE CASCADE,
 status text NOT NULL CHECK (status IN ('pending','approved','rejected')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_quality_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_quality_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_quality_requests TO authenticated;
CREATE POLICY quality_requests_owner_read ON public.company_quality_requests FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id WHERE p.id=profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY quality_requests_admin_read ON public.company_quality_requests FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid()))
);
-- No direct writes. Definer RPCs explicitly authorize every caller and lock the
-- parent profile to serialize requests and decisions, including first requests.
CREATE FUNCTION public.request_company_verification(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authorized'; END IF;
 PERFORM p.id FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
 WHERE p.id=p_profile_id AND c.owner_user_id=auth.uid() FOR UPDATE OF p;
 IF NOT FOUND THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF EXISTS (SELECT 1 FROM public.company_quality_reviews WHERE profile_id=p_profile_id) THEN RAISE EXCEPTION 'already verified'; END IF;
 INSERT INTO public.company_quality_requests(profile_id,status) VALUES(p_profile_id,'pending')
 ON CONFLICT(profile_id) DO UPDATE SET status='pending',requested_at=clock_timestamp(),decided_at=NULL,updated_at=clock_timestamp()
 -- Repeated pending requests preserve their date. After removal of a seal, a
 -- previously approved request may be submitted again, just like a rejected one.
 WHERE company_quality_requests.status IN ('rejected','approved');
END;
$$;
CREATE FUNCTION public.reject_company_verification_request(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
 PERFORM id FROM public.company_profiles WHERE id=p_profile_id FOR UPDATE;
 IF EXISTS (SELECT 1 FROM public.company_quality_reviews WHERE profile_id=p_profile_id) THEN RAISE EXCEPTION 'already verified'; END IF;
 UPDATE public.company_quality_requests SET status='rejected',decided_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE profile_id=p_profile_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'pending request required'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.verify_company_profile(p_profile_id uuid,p_public_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); note text := nullif(btrim(p_public_note,E' \t\n\r'),'');
BEGIN
 IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.portal_admins a WHERE a.user_id=actor) THEN RAISE EXCEPTION 'not authorized'; END IF;
 IF char_length(note)>1000 THEN RAISE EXCEPTION 'invalid note'; END IF;
 PERFORM id FROM public.company_profiles WHERE id=p_profile_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 -- Existing seals remain manageable even if they predate the request workflow.
 IF NOT EXISTS (SELECT 1 FROM public.company_quality_reviews WHERE profile_id=p_profile_id)
 AND NOT EXISTS (SELECT 1 FROM public.company_quality_requests WHERE profile_id=p_profile_id AND status='pending') THEN
   RAISE EXCEPTION 'pending request required';
 END IF;
 INSERT INTO public.company_quality_reviews(profile_id,status,verified_at,verified_by,public_note)
 VALUES(p_profile_id,'verified',clock_timestamp(),actor,note)
 ON CONFLICT(profile_id) DO UPDATE SET status='verified',verified_at=clock_timestamp(),verified_by=actor,public_note=note,updated_at=clock_timestamp();
 UPDATE public.company_quality_requests SET status='approved',decided_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE profile_id=p_profile_id AND status='pending';
END;
$$;
REVOKE ALL ON FUNCTION public.request_company_verification(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_company_verification_request(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_company_profile(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_company_verification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_company_verification_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_company_profile(uuid,text) TO authenticated;
