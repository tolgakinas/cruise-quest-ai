DROP FUNCTION IF EXISTS public.excursion_seats_taken(uuid, date);

CREATE OR REPLACE FUNCTION private.excursion_seats_taken(_excursion_id uuid, _tour_date date)
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

REVOKE ALL ON FUNCTION private.excursion_seats_taken(uuid, date) FROM PUBLIC;