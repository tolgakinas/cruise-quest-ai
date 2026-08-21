CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- profiles
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = id OR private.has_role(auth.uid(),'admin'));

-- user_roles
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

-- bookings
DROP POLICY IF EXISTS bookings_own_select ON public.bookings;
CREATE POLICY bookings_own_select ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS bookings_own_update ON public.bookings;
CREATE POLICY bookings_own_update ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS bookings_admin_delete ON public.bookings;
CREATE POLICY bookings_admin_delete ON public.bookings FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- payments
DROP POLICY IF EXISTS payments_own_select ON public.payments;
CREATE POLICY payments_own_select ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR private.has_role(auth.uid(),'admin'));

-- catalogue admin policies
DROP POLICY IF EXISTS cruise_lines_admin_all ON public.cruise_lines;
CREATE POLICY cruise_lines_admin_all ON public.cruise_lines FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS ships_admin_all ON public.ships;
CREATE POLICY ships_admin_all ON public.ships FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS ports_admin_all ON public.ports;
CREATE POLICY ports_admin_all ON public.ports FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS port_calls_admin_all ON public.sailing_port_calls;
CREATE POLICY port_calls_admin_all ON public.sailing_port_calls FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));

-- sailings: explicit per-command admin writes + reads
DROP POLICY IF EXISTS sailings_admin_all ON public.sailings;
DROP POLICY IF EXISTS sailings_auth_read ON public.sailings;
DROP POLICY IF EXISTS sailings_anon_read ON public.sailings;
CREATE POLICY sailings_anon_read ON public.sailings FOR SELECT TO anon USING (is_published);
CREATE POLICY sailings_auth_read ON public.sailings FOR SELECT TO authenticated
  USING (is_published OR private.has_role(auth.uid(),'admin'));
CREATE POLICY sailings_admin_insert ON public.sailings FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY sailings_admin_update ON public.sailings FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY sailings_admin_delete ON public.sailings FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- excursions
DROP POLICY IF EXISTS excursions_admin_all ON public.excursions;
DROP POLICY IF EXISTS excursions_auth_read ON public.excursions;
DROP POLICY IF EXISTS excursions_anon_read ON public.excursions;
CREATE POLICY excursions_anon_read ON public.excursions FOR SELECT TO anon USING (is_published);
CREATE POLICY excursions_auth_read ON public.excursions FOR SELECT TO authenticated
  USING (is_published OR private.has_role(auth.uid(),'admin'));
CREATE POLICY excursions_admin_insert ON public.excursions FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY excursions_admin_update ON public.excursions FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE POLICY excursions_admin_delete ON public.excursions FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(),'admin'));

-- drafts are private by default
ALTER TABLE public.sailings ALTER COLUMN is_published SET DEFAULT false;
ALTER TABLE public.excursions ALTER COLUMN is_published SET DEFAULT false;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);