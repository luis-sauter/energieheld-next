-- Same public address gate as public_basic_map_contacts, bounded to candidate IDs.
CREATE FUNCTION public.public_basic_map_contacts_by_ids(p_ids uuid[])
RETURNS TABLE(id uuid,address jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_ids IS NULL OR cardinality(p_ids)>500 THEN RAISE EXCEPTION 'invalid map candidates' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT b.id,b.address FROM public.basic_accommodation_contacts b
 WHERE b.id=ANY(p_ids) AND b.is_listed AND (b.rights_valid_until IS NULL OR b.rights_valid_until>statement_timestamp())
 ORDER BY b.id;
END; $$;
REVOKE ALL ON FUNCTION public.public_basic_map_contacts_by_ids(uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.public_basic_map_contacts_by_ids(uuid[]) TO anon,authenticated;
