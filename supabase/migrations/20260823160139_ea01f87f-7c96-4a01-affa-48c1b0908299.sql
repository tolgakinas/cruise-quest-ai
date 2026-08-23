-- In-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  href text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Passengers mark their own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Outgoing email queue for reservation status changes
CREATE TABLE public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  template text NOT NULL DEFAULT 'booking_status',
  status text NOT NULL DEFAULT 'pending',
  error text,
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_status_idx ON public.email_outbox (status, created_at);

GRANT SELECT ON public.email_outbox TO authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read the email queue"
  ON public.email_outbox FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

CREATE TRIGGER t_email_outbox_updated BEFORE UPDATE ON public.email_outbox
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fan out a notification + queued email whenever a reservation status changes
CREATE OR REPLACE FUNCTION public.notify_booking_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _title text;
  _body text;
  _type text;
  _tour text;
  _port text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT e.title, p.name INTO _tour, _port
  FROM public.excursions e
  LEFT JOIN public.ports p ON p.id = e.port_id
  WHERE e.id = NEW.excursion_id;

  IF TG_OP = 'INSERT' THEN
    _type := 'booking.reserved';
    _title := 'Reservation held — ' || NEW.reference;
    _body := 'We are holding ' || NEW.party_size || ' place(s) on ' || COALESCE(_tour, 'your tour') ||
             ' in ' || COALESCE(_port, 'port') || ' on ' || to_char(NEW.tour_date, 'DD Mon YYYY') ||
             '. Complete payment to secure your places.';
  ELSE
    _type := 'booking.' || NEW.status::text;
    IF NEW.status = 'confirmed' THEN
      _title := 'Reservation confirmed — ' || NEW.reference;
      _body := 'Your place on ' || COALESCE(_tour, 'your tour') || ' in ' || COALESCE(_port, 'port') ||
               ' on ' || to_char(NEW.tour_date, 'DD Mon YYYY') || ' is paid and secured. Your voucher is in your account.';
    ELSIF NEW.status = 'cancelled' THEN
      _title := 'Reservation cancelled — ' || NEW.reference;
      _body := COALESCE(_tour, 'Your tour') || ' on ' || to_char(NEW.tour_date, 'DD Mon YYYY') ||
               ' has been cancelled. Any refund is reviewed by our reservations team.';
    ELSIF NEW.status = 'refunded' THEN
      _title := 'Refund issued — ' || NEW.reference;
      _body := 'We have refunded ' || NEW.total_amount::text || ' ' || NEW.currency || ' for ' ||
               COALESCE(_tour, 'your tour') || '. Allow a few business days for it to appear.';
    ELSE
      _title := 'Reservation awaiting payment — ' || NEW.reference;
      _body := COALESCE(_tour, 'Your tour') || ' on ' || to_char(NEW.tour_date, 'DD Mon YYYY') ||
               ' is on hold again and awaiting payment.';
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, booking_id, type, title, body, href)
  VALUES (NEW.user_id, NEW.id, _type, _title, _body, '/account/bookings/' || NEW.reference);

  INSERT INTO public.email_outbox (user_id, booking_id, to_email, subject, body)
  VALUES (NEW.user_id, NEW.id, NEW.lead_passenger_email, _title,
          'Dear ' || COALESCE(NEW.lead_passenger_name, 'guest') || E',\n\n' || _body ||
          E'\n\nReference: ' || NEW.reference || E'\n\nShore Hopper');

  RETURN NEW;
END; $$;

CREATE TRIGGER t_bookings_notify
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_booking_status();