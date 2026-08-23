CREATE TABLE public.shoreex_itinerary_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sailing_id uuid NOT NULL UNIQUE REFERENCES public.sailings(id) ON DELETE CASCADE,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shoreex_queue_pending ON public.shoreex_itinerary_queue (status, created_at);

GRANT SELECT ON public.shoreex_itinerary_queue TO authenticated;
GRANT ALL ON public.shoreex_itinerary_queue TO service_role;
ALTER TABLE public.shoreex_itinerary_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY shoreex_queue_admin_read ON public.shoreex_itinerary_queue
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER t_shoreex_queue_updated BEFORE UPDATE ON public.shoreex_itinerary_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();