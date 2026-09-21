-- Repository only: apply separately after review. No outbound notification side effects.
CREATE TABLE public.company_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 50),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.company_leads IS 'Persisted inquiries. Future notifications can consume INSERT events using id; notification delivery must not block creation.';
CREATE INDEX company_leads_inbox_idx ON public.company_leads(profile_id, created_at DESC, id DESC);
CREATE INDEX company_leads_dedupe_idx ON public.company_leads(profile_id, email, created_at DESC);
ALTER TABLE public.company_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_leads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_leads TO authenticated;
GRANT UPDATE (status) ON public.company_leads TO authenticated;
CREATE POLICY company_leads_owner_select ON public.company_leads FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE p.id=company_leads.profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE POLICY company_leads_owner_update ON public.company_leads FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE p.id=company_leads.profile_id AND c.owner_user_id=(SELECT auth.uid()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.company_profiles p JOIN public.companies c ON c.id=p.company_id
    WHERE p.id=company_leads.profile_id AND c.owner_user_id=(SELECT auth.uid()))
);
CREATE FUNCTION public.company_lead_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.company_lead_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER company_lead_updated_at BEFORE UPDATE ON public.company_leads
FOR EACH ROW EXECUTE FUNCTION public.company_lead_updated_at();

CREATE FUNCTION public.create_company_lead(
 p_profile_id uuid, p_name text, p_email text, p_phone text, p_message text,
 p_consent boolean, p_website text DEFAULT ''
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_name text := btrim(p_name, E' \t\n\r');
 v_email text := lower(btrim(p_email, E' \t\n\r'));
 v_phone text := nullif(btrim(p_phone, E' \t\n\r'),'');
 v_message text := btrim(p_message, E' \t\n\r');
BEGIN
 IF p_consent IS DISTINCT FROM true OR coalesce(p_website,'') <> '' THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 120
 OR v_email IS NULL OR char_length(v_email) NOT BETWEEN 3 AND 254
 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 OR (v_phone IS NOT NULL AND char_length(v_phone)>50)
 OR v_message IS NULL OR char_length(v_message) NOT BETWEEN 1 AND 5000
 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 -- REST uses READ COMMITTED. Reject other isolation levels rather than permit a
 -- stale transaction snapshot to bypass the post-lock duplicate check.
 IF current_setting('transaction_isolation') <> 'read committed' THEN RAISE EXCEPTION 'unsupported_transaction'; END IF;
 -- Serialize the same sender/profile across concurrent calls, without storing IPs.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::text || ':' || v_email, 0));
 PERFORM 1 FROM public.company_profiles WHERE id=p_profile_id AND status='approved' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_unavailable'; END IF;
 IF EXISTS (SELECT 1 FROM public.company_leads WHERE profile_id=p_profile_id AND email=v_email
   AND message=v_message AND created_at > clock_timestamp() - interval '5 minutes')
 THEN RAISE EXCEPTION 'duplicate_lead'; END IF;
 INSERT INTO public.company_leads(profile_id,name,email,phone,message) VALUES(p_profile_id,v_name,v_email,v_phone,v_message);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.create_company_lead(uuid,text,text,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_lead(uuid,text,text,text,text,boolean,text) TO anon, authenticated;
