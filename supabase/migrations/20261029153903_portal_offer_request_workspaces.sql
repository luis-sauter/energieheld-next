BEGIN;
-- Internal additions are separate from the customer's immutable submission.
CREATE TABLE public.portal_offer_request_workspaces (
 request_id uuid PRIMARY KEY REFERENCES public.company_ad_campaigns(id),
 details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details)='object' AND octet_length(details::text)<=12000),
 notes jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(notes)='array' AND octet_length(notes::text)<=500000),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_offer_request_workspaces ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_offer_request_workspaces FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.portal_offer_request_workspaces TO authenticated;
CREATE POLICY admin_workspace ON public.portal_offer_request_workspaces FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.portal_admins a WHERE a.user_id=(SELECT auth.uid())));

CREATE FUNCTION public.save_portal_offer_request_workspace(p_id uuid,p_status text,p_details jsonb,p_note text,p_revision integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w public.portal_offer_request_workspaces; next_revision integer; note text:=nullif(btrim(p_note),'');
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=auth.uid()) THEN
  RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';
 END IF;
 IF p_revision IS NULL OR p_revision<0 OR jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR octet_length(p_details::text)>12000
 OR char_length(note)>4000 OR EXISTS(SELECT 1 FROM jsonb_each(p_details) e WHERE e.key NOT IN
 ('company_name','contact_name','contact_email','contact_phone','website','internal_name','requested_start_date','requested_end_date','placement_notes')
 OR jsonb_typeof(e.value)<>'string' OR char_length(e.value #>> '{}')>2000)
 THEN RAISE EXCEPTION 'invalid workspace'; END IF;
 -- Serialize the first workspace creation too, without modifying source data.
 PERFORM pg_catalog.pg_advisory_xact_lock(20261029,pg_catalog.hashtext(p_id::text));
 PERFORM 1 FROM public.company_ad_campaigns WHERE id=p_id AND request_status IS NOT NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'offer request not found'; END IF;
 SELECT * INTO w FROM public.portal_offer_request_workspaces WHERE request_id=p_id FOR UPDATE;
 IF coalesce(w.revision,0)<>p_revision THEN RAISE EXCEPTION 'request_changed'; END IF;
 next_revision:=coalesce(w.revision,0)+1;
 PERFORM public.set_portal_offer_request_status(p_id,p_status);
 INSERT INTO public.portal_offer_request_workspaces(request_id,details,notes,revision,updated_at)
 VALUES(p_id,p_details,coalesce(w.notes,'[]'::jsonb)||CASE WHEN note IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object('text',note,'at',clock_timestamp(),'author',auth.uid())) END,next_revision,clock_timestamp())
 ON CONFLICT(request_id) DO UPDATE SET details=EXCLUDED.details,notes=EXCLUDED.notes,revision=EXCLUDED.revision,updated_at=EXCLUDED.updated_at;
 RETURN next_revision;
END; $$;
REVOKE ALL ON FUNCTION public.save_portal_offer_request_workspace(uuid,text,jsonb,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_portal_offer_request_workspace(uuid,text,jsonb,text,integer) TO authenticated;
COMMIT;
