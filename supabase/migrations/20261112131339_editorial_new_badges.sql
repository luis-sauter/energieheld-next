BEGIN;
SET LOCAL lock_timeout='3s';
CREATE TABLE public.editorial_new_badges (
 kind text NOT NULL CHECK(kind IN('profile','basic','banner')),
 entity_id uuid NOT NULL,
 enabled boolean NOT NULL DEFAULT false,
 starts_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(kind,entity_id),
 CHECK(expires_at>starts_at)
);
ALTER TABLE public.editorial_new_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.editorial_new_badges FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.editorial_new_badges TO anon,authenticated;
CREATE FUNCTION private.new_badge_target_public(p_kind text,p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (p_kind='profile' AND EXISTS(SELECT FROM public.company_profiles p WHERE p.id=p_id AND p.status='approved' AND NOT EXISTS(SELECT FROM public.company_profile_public_visibility v WHERE v.profile_id=p.id AND NOT v.is_listed)))
 OR (p_kind='banner' AND EXISTS(SELECT FROM public.company_ad_campaigns c WHERE c.id=p_id AND c.status='approved' AND c.archived_at IS NULL AND c.deletion_requested_at IS NULL))
 OR (p_kind='basic' AND EXISTS(SELECT FROM public.basic_accommodation_contacts b WHERE b.id=p_id AND b.is_listed AND(b.rights_valid_until IS NULL OR b.rights_valid_until>now())));
$$;
REVOKE ALL ON FUNCTION private.new_badge_target_public(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.new_badge_target_public(text,uuid) TO anon,authenticated;
CREATE POLICY badge_public_read ON public.editorial_new_badges FOR SELECT TO anon,authenticated USING(private.new_badge_target_public(kind,entity_id));
CREATE POLICY badge_admin_read ON public.editorial_new_badges FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.portal_admins WHERE user_id=(SELECT auth.uid())));
CREATE TABLE private.editorial_new_badge_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL, entity_id uuid NOT NULL, before_value jsonb, after_value jsonb NOT NULL
);
REVOKE ALL ON private.editorial_new_badge_events FROM PUBLIC,anon,authenticated;
ALTER TABLE private.editorial_new_badge_events ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION private.save_editorial_new_badge(p_kind text,p_id uuid,p_enabled boolean,p_expires_at timestamptz,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.editorial_new_badges; saved public.editorial_new_badges; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT FROM public.portal_admins WHERE user_id=actor) THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN('profile','basic','banner') OR p_id IS NULL OR p_enabled IS NULL OR p_revision IS NULL OR p_revision<0 THEN RAISE EXCEPTION 'Invalid badge'; END IF;
 IF p_enabled AND(p_expires_at IS NULL OR p_expires_at<=now() OR p_expires_at>now()+interval '366 days') THEN RAISE EXCEPTION 'Invalid expiry'; END IF;
 IF NOT (p_kind='profile' AND EXISTS(SELECT FROM public.company_profiles WHERE id=p_id)
 OR p_kind='banner' AND EXISTS(SELECT FROM public.company_ad_campaigns WHERE id=p_id AND request_status IS NULL)
 OR p_kind='basic' AND EXISTS(SELECT FROM public.basic_accommodation_contacts WHERE id=p_id)) THEN RAISE EXCEPTION 'Entry not found'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261112,pg_catalog.hashtext(p_kind||p_id::text));
 SELECT * INTO previous FROM public.editorial_new_badges WHERE kind=p_kind AND entity_id=p_id FOR UPDATE;
 IF coalesce(previous.revision,0)<>p_revision THEN RAISE EXCEPTION 'Badge changed' USING ERRCODE='40001'; END IF;
 INSERT INTO public.editorial_new_badges(kind,entity_id,enabled,starts_at,expires_at,revision)
 VALUES(p_kind,p_id,p_enabled,now(),coalesce(p_expires_at,now()+interval '14 days'),p_revision+1)
 ON CONFLICT(kind,entity_id) DO UPDATE SET enabled=excluded.enabled,starts_at=excluded.starts_at,expires_at=excluded.expires_at,revision=excluded.revision
 RETURNING * INTO saved;
 INSERT INTO private.editorial_new_badge_events(actor,kind,entity_id,before_value,after_value) VALUES(actor,p_kind,p_id,CASE WHEN previous.entity_id IS NOT NULL THEN to_jsonb(previous) END,to_jsonb(saved));
 RETURN to_jsonb(saved);
END; $$;
REVOKE ALL ON FUNCTION private.save_editorial_new_badge(text,uuid,boolean,timestamptz,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.save_editorial_new_badge(text,uuid,boolean,timestamptz,bigint) TO authenticated;
CREATE FUNCTION public.save_editorial_new_badge(p_kind text,p_id uuid,p_enabled boolean,p_expires_at timestamptz,p_revision bigint)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' BEGIN ATOMIC
 SELECT private.save_editorial_new_badge(p_kind,p_id,p_enabled,p_expires_at,p_revision);
END;
REVOKE ALL ON FUNCTION public.save_editorial_new_badge(text,uuid,boolean,timestamptz,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_editorial_new_badge(text,uuid,boolean,timestamptz,bigint) TO authenticated;
INSERT INTO public.editorial_new_badges(kind,entity_id,enabled,starts_at,expires_at) VALUES
('profile','6e3b9664-f503-413a-9349-a31379881a8a',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','0c8598b3-a2d2-45ad-bcbb-e19c4ee80e84',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','d77ca77b-af21-47af-a6b1-79e2f8d4f6f8',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','a6249a1b-7890-45f9-9765-1c937144c114',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','9a1a97da-2aad-439c-973d-8416ef4b4345',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','97578023-61cb-43f8-b650-676f3baa7777',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','6b6ffc6e-cceb-49a2-8e4f-ea6aa975b6df',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','4a740b14-2efb-44de-a472-f4f135d01cf0',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','1053f4b5-9c23-4ade-850d-214edebc9d4c',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','790d18be-6ba8-4849-bdbb-fc3cc3489905',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','7cbcbcf2-0df8-49db-b5e3-6c832234ea02',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','774d0a87-db37-4d89-ab68-1f5c6b3c1580',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','fd8f5c9c-dcc7-4f8e-831d-c389a010608e',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','1b457835-2067-418c-a1b9-8d0608638790',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00'),
('profile','97e8cd41-abb6-4ba2-951f-fa0849ec2987',true,'2026-11-02T00:00:00+01:00','2026-11-16T00:00:00+01:00');
COMMIT;
