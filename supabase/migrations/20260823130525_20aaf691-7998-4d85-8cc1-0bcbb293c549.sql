-- Reservation change history
CREATE TABLE public.booking_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_modifications TO authenticated;
GRANT ALL ON public.booking_modifications TO service_role;
ALTER TABLE public.booking_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_mods_select ON public.booking_modifications
  FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

CREATE POLICY booking_mods_insert ON public.booking_modifications
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid())
  );

CREATE INDEX idx_booking_mods_booking ON public.booking_modifications(booking_id, created_at DESC);

-- Importer sources
CREATE TABLE public.import_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  parser text NOT NULL DEFAULT 'generic',
  cruise_line_slug text,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_sources TO authenticated;
GRANT ALL ON public.import_sources TO service_role;
ALTER TABLE public.import_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_sources_admin_all ON public.import_sources
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER t_import_sources_updated BEFORE UPDATE ON public.import_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Importer runs
CREATE TABLE public.import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.import_sources(id) ON DELETE SET NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  sailings_created integer NOT NULL DEFAULT 0,
  sailings_updated integer NOT NULL DEFAULT 0,
  port_calls_created integer NOT NULL DEFAULT 0,
  port_calls_updated integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_runs_admin_read ON public.import_runs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_import_runs_started ON public.import_runs(started_at DESC);

-- Richer excursion detail
ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS includes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excludes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean NOT NULL DEFAULT false;

-- Seats already taken for an excursion on a date
CREATE OR REPLACE FUNCTION public.excursion_seats_taken(_excursion_id uuid, _tour_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(party_size), 0)::int
  FROM public.bookings
  WHERE excursion_id = _excursion_id
    AND tour_date = _tour_date
    AND status IN ('reserved','confirmed')
    AND (status = 'confirmed' OR expires_at IS NULL OR expires_at > now())
$$;

REVOKE ALL ON FUNCTION public.excursion_seats_taken(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excursion_seats_taken(uuid, date) TO service_role;