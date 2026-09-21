-- Existing company RLS checks this column; portal_admins RLS restricts it to self.
GRANT SELECT (user_id) ON public.portal_admins TO authenticated;
