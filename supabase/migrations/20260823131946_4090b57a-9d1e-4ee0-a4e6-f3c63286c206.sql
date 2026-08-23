-- Add-ons offered on an excursion
CREATE TABLE public.excursion_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excursion_id uuid NOT NULL REFERENCES public.excursions(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'USD',
  per_guest boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_excursion_addons_excursion ON public.excursion_addons(excursion_id);

GRANT SELECT ON public.excursion_addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.excursion_addons TO authenticated;
GRANT ALL ON public.excursion_addons TO service_role;
ALTER TABLE public.excursion_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active add-ons" ON public.excursion_addons
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins can view all add-ons" ON public.excursion_addons
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create add-ons" ON public.excursion_addons
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update add-ons" ON public.excursion_addons
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete add-ons" ON public.excursion_addons
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER t_excursion_addons_updated BEFORE UPDATE ON public.excursion_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add-ons attached to a booking (price snapshot)
CREATE TABLE public.booking_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.excursion_addons(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_booking_addons_booking ON public.booking_addons(booking_id);

GRANT SELECT, INSERT, DELETE ON public.booking_addons TO authenticated;
GRANT ALL ON public.booking_addons TO service_role;
ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers view own booking add-ons" ON public.booking_addons
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Passengers add own booking add-ons" ON public.booking_addons
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );
CREATE POLICY "Passengers remove own booking add-ons" ON public.booking_addons
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin')
  );

-- Refund requests reviewed by admins
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  amount numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refund_requests_status ON public.refund_requests(status);
CREATE INDEX idx_refund_requests_booking ON public.refund_requests(booking_id);

GRANT SELECT, INSERT, UPDATE ON public.refund_requests TO authenticated;
GRANT ALL ON public.refund_requests TO service_role;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers view own refund requests" ON public.refund_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Passengers create own refund requests" ON public.refund_requests
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );
CREATE POLICY "Admins review refund requests" ON public.refund_requests
  FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER t_refund_requests_updated BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sample add-ons on existing excursions
INSERT INTO public.excursion_addons (excursion_id, name, description, price, currency, per_guest, sort_order)
SELECT e.id, 'Private port transfer', 'Private car from the pier to the meeting point and back.', 45.00, e.currency, false, 1
FROM public.excursions e;

INSERT INTO public.excursion_addons (excursion_id, name, description, price, currency, per_guest, sort_order)
SELECT e.id, 'Local lunch upgrade', 'Three-course lunch at a family-run restaurant.', 35.00, e.currency, true, 2
FROM public.excursions e;

INSERT INTO public.excursion_addons (excursion_id, name, description, price, currency, per_guest, sort_order)
SELECT e.id, 'Photo package', 'A guide-shot photo album of your day ashore, delivered digitally.', 25.00, e.currency, false, 3
FROM public.excursions e;

INSERT INTO public.excursion_addons (excursion_id, name, description, price, currency, per_guest, sort_order)
SELECT e.id, 'Skip-the-line entry', 'Priority admission where the site allows it.', 18.00, e.currency, true, 4
FROM public.excursions e
WHERE e.category IN ('Culture', 'History', 'culture', 'history');