CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  actor_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- writer helper: runs as owner so trigger inserts bypass RLS; not callable by API roles
CREATE OR REPLACE FUNCTION public.write_audit_log(
  _action text, _entity_type text, _entity_id uuid, _summary text, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _email text; _name text;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email, full_name INTO _email, _name FROM public.profiles WHERE id = _uid;
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_email, actor_name, action, entity_type, entity_id, summary, metadata)
  VALUES (_uid, _email, _name, _action, _entity_type, _entity_id, _summary, COALESCE(_metadata,'{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.write_audit_log(text,text,uuid,text,jsonb) FROM public, anon, authenticated;

-- sailings
CREATE OR REPLACE FUNCTION public.audit_sailings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log('sailing.created','sailing',NEW.id,
      'Created sailing "' || NEW.name || '"', jsonb_build_object('is_published', NEW.is_published, 'region', NEW.region));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log('sailing.deleted','sailing',OLD.id, 'Deleted sailing "' || OLD.name || '"');
    RETURN OLD;
  ELSE
    IF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
      PERFORM public.write_audit_log(
        CASE WHEN NEW.is_published THEN 'sailing.published' ELSE 'sailing.unpublished' END,
        'sailing', NEW.id,
        CASE WHEN NEW.is_published THEN 'Published sailing "' ELSE 'Unpublished sailing "' END || NEW.name || '"');
    ELSE
      PERFORM public.write_audit_log('sailing.updated','sailing',NEW.id,'Updated sailing "' || NEW.name || '"');
    END IF;
    RETURN NEW;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.audit_sailings() FROM public, anon, authenticated;
CREATE TRIGGER t_sailings_audit AFTER INSERT OR UPDATE OR DELETE ON public.sailings
  FOR EACH ROW EXECUTE FUNCTION public.audit_sailings();

-- excursions
CREATE OR REPLACE FUNCTION public.audit_excursions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log('excursion.created','excursion',NEW.id,
      'Created excursion "' || NEW.title || '"', jsonb_build_object('price', NEW.price, 'currency', NEW.currency, 'is_published', NEW.is_published));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit_log('excursion.deleted','excursion',OLD.id,'Deleted excursion "' || OLD.title || '"');
    RETURN OLD;
  ELSE
    IF NEW.is_published IS DISTINCT FROM OLD.is_published THEN
      PERFORM public.write_audit_log(
        CASE WHEN NEW.is_published THEN 'excursion.published' ELSE 'excursion.unpublished' END,
        'excursion', NEW.id,
        CASE WHEN NEW.is_published THEN 'Published excursion "' ELSE 'Unpublished excursion "' END || NEW.title || '"');
    ELSE
      PERFORM public.write_audit_log('excursion.updated','excursion',NEW.id,'Updated excursion "' || NEW.title || '"');
    END IF;
    RETURN NEW;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.audit_excursions() FROM public, anon, authenticated;
CREATE TRIGGER t_excursions_audit AFTER INSERT OR UPDATE OR DELETE ON public.excursions
  FOR EACH ROW EXECUTE FUNCTION public.audit_excursions();

-- bookings
CREATE OR REPLACE FUNCTION public.audit_bookings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit_log('booking.created','booking',NEW.id,
      'Booking ' || NEW.reference || ' created', jsonb_build_object('total_amount', NEW.total_amount, 'currency', NEW.currency, 'party_size', NEW.party_size));
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.write_audit_log('booking.' || NEW.status::text,'booking',NEW.id,
      'Booking ' || NEW.reference || ' marked ' || NEW.status::text,
      jsonb_build_object('from', OLD.status::text, 'to', NEW.status::text, 'total_amount', NEW.total_amount, 'currency', NEW.currency));
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_bookings() FROM public, anon, authenticated;
CREATE TRIGGER t_bookings_audit AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_bookings();

-- payments
CREATE OR REPLACE FUNCTION public.audit_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  PERFORM public.write_audit_log('payment.' || NEW.status::text,'payment',NEW.id,
    'Payment of ' || NEW.amount::text || ' ' || NEW.currency || ' marked ' || NEW.status::text,
    jsonb_build_object('booking_id', NEW.booking_id, 'provider', NEW.provider, 'amount', NEW.amount, 'currency', NEW.currency));
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.audit_payments() FROM public, anon, authenticated;
CREATE TRIGGER t_payments_audit AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_payments();