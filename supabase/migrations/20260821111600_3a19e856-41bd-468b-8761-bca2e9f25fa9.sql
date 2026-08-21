
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

DROP POLICY "sailings_public_read" ON public.sailings;
CREATE POLICY "sailings_anon_read" ON public.sailings FOR SELECT TO anon USING (is_published);
CREATE POLICY "sailings_auth_read" ON public.sailings FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(),'admin'));

DROP POLICY "excursions_public_read" ON public.excursions;
CREATE POLICY "excursions_anon_read" ON public.excursions FOR SELECT TO anon USING (is_published);
CREATE POLICY "excursions_auth_read" ON public.excursions FOR SELECT TO authenticated
  USING (is_published OR public.has_role(auth.uid(),'admin'));
