BEGIN;
CREATE TABLE private.offer_request_mail_receipts (
 request_id uuid PRIMARY KEY REFERENCES public.company_ad_campaigns(id) ON DELETE CASCADE,
 claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
 state text NOT NULL DEFAULT 'sending' CHECK(state IN ('sending','accepted','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz
);
ALTER TABLE private.offer_request_mail_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.offer_request_mail_receipts FROM PUBLIC,anon,authenticated;
-- The unguessable submission key is the same capability used by the existing
-- public submission/upload flow. No contact data is returned. One attempt only,
-- including ambiguous SMTP failures: automatic retries could send duplicates.
CREATE FUNCTION private.claim_offer_request_mail(p_key uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token uuid;
BEGIN
 INSERT INTO private.offer_request_mail_receipts(request_id)
 SELECT id FROM public.company_ad_campaigns
 WHERE request_key=p_key AND id=p_key AND request_status='new'
 AND created_at>now()-interval '1 hour'
 AND (request_details->>'upload_path' IS NULL OR image_path=request_details->>'upload_path')
 ON CONFLICT(request_id) DO NOTHING RETURNING claim_token INTO token;
 RETURN token;
END; $$;
CREATE FUNCTION public.claim_offer_request_mail(p_key uuid) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.claim_offer_request_mail(p_key); END;
CREATE FUNCTION private.finish_offer_request_mail(p_key uuid,p_token uuid,p_accepted boolean) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=''
BEGIN ATOMIC
 UPDATE private.offer_request_mail_receipts SET state=CASE WHEN p_accepted IS TRUE THEN 'accepted' ELSE 'failed' END,finished_at=now()
 WHERE request_id=p_key AND claim_token=p_token AND state='sending';
END;
CREATE FUNCTION public.finish_offer_request_mail(p_key uuid,p_token uuid,p_accepted boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path=''
BEGIN ATOMIC SELECT private.finish_offer_request_mail(p_key,p_token,p_accepted); END;
REVOKE ALL ON FUNCTION private.claim_offer_request_mail(uuid),public.claim_offer_request_mail(uuid),private.finish_offer_request_mail(uuid,uuid,boolean),public.finish_offer_request_mail(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.claim_offer_request_mail(uuid),public.claim_offer_request_mail(uuid),private.finish_offer_request_mail(uuid,uuid,boolean),public.finish_offer_request_mail(uuid,uuid,boolean) TO anon,authenticated;
COMMIT;
