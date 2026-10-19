-- Public map visibility gate. Reads only the existing public contact projection;
-- no coordinates, source evidence or acquisition fields are exposed here.
CREATE FUNCTION public.public_basic_map_contacts(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 1000)
RETURNS TABLE(id uuid, address jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'invalid map page size' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY SELECT b.id, b.address
    FROM public.basic_accommodation_contacts b
    WHERE b.is_listed
      AND (b.rights_valid_until IS NULL OR b.rights_valid_until > statement_timestamp())
      AND (p_after IS NULL OR b.id > p_after)
    ORDER BY b.id LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.public_basic_map_contacts(uuid, integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_basic_map_contacts(uuid, integer) TO anon, authenticated;
COMMENT ON FUNCTION public.public_basic_map_contacts(uuid, integer)
  IS 'Bounded keyset read of currently public Basic IDs and public addresses for the homepage map. No acquisition access.';
