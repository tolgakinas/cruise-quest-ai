GRANT UPDATE ON public.booking_addons TO authenticated;

CREATE POLICY "Passengers update own booking add-ons" ON public.booking_addons
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin')
  );