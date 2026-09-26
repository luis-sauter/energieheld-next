-- Joomla article 472 has country-bd=IT, but its independent location tag is
-- "Schweiz" and the same article identifies 6197 Schangnau and +41 telephone.
-- Correct only the newly imported profile; leave every other field untouched.
UPDATE public.company_profiles AS p
SET country = 'Schweiz'
FROM public.companies AS c
WHERE p.company_id = c.id
  AND p.slug = 'kemmeriboden-bad'
  AND p.city = 'Schangnau'
  AND p.postal_code = '6197'
  AND p.country = 'Italien'
  AND c.owner_user_id IS NULL
  AND p.status = 'approved';
