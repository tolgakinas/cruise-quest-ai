
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','passenger');
CREATE TYPE public.booking_status AS ENUM ('reserved','confirmed','cancelled','refunded');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');

-- SHARED updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  cabin_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passenger')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CRUISE LINES
CREATE TABLE public.cruise_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- SHIPS
CREATE TABLE public.ships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cruise_line_id UUID NOT NULL REFERENCES public.cruise_lines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  capacity INTEGER,
  year_built INTEGER,
  description TEXT,
  image_url TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- PORTS
CREATE TABLE public.ports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  region TEXT,
  description TEXT,
  image_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- SAILINGS
CREATE TABLE public.sailings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_id UUID NOT NULL REFERENCES public.ships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  region TEXT NOT NULL,
  departure_port_id UUID REFERENCES public.ports(id),
  arrival_port_id UUID REFERENCES public.ports(id),
  departure_date DATE NOT NULL,
  arrival_date DATE NOT NULL,
  nights INTEGER NOT NULL,
  starting_price NUMERIC(10,2),
  hero_image_url TEXT,
  description TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- PORT CALLS
CREATE TABLE public.sailing_port_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sailing_id UUID NOT NULL REFERENCES public.sailings(id) ON DELETE CASCADE,
  port_id UUID REFERENCES public.ports(id) ON DELETE SET NULL,
  day_number INTEGER NOT NULL,
  call_date DATE NOT NULL,
  arrival_time TIME,
  departure_time TIME,
  is_sea_day BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sailing_id, day_number)
);

-- EXCURSIONS
CREATE TABLE public.excursions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  port_id UUID NOT NULL REFERENCES public.ports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 180,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  capacity INTEGER NOT NULL DEFAULT 20,
  meeting_point TEXT,
  category TEXT,
  difficulty TEXT,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

-- BOOKINGS
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE DEFAULT ('SH-' || upper(substr(md5(random()::text),1,8))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  excursion_id UUID NOT NULL REFERENCES public.excursions(id) ON DELETE RESTRICT,
  sailing_id UUID REFERENCES public.sailings(id) ON DELETE SET NULL,
  port_call_id UUID REFERENCES public.sailing_port_calls(id) ON DELETE SET NULL,
  tour_date DATE NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  total_amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.booking_status NOT NULL DEFAULT 'reserved',
  lead_passenger_name TEXT NOT NULL,
  lead_passenger_email TEXT NOT NULL,
  lead_passenger_phone TEXT,
  cabin_number TEXT,
  notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_session_id TEXT,
  provider_payment_intent TEXT,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI CONVERSATIONS
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT ON public.cruise_lines, public.ships, public.ports, public.sailings, public.sailing_port_calls, public.excursions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cruise_lines, public.ships, public.ports, public.sailings, public.sailing_port_calls, public.excursions TO authenticated;
GRANT ALL ON public.cruise_lines, public.ships, public.ports, public.sailings, public.sailing_port_calls, public.excursions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings, public.payments, public.ai_conversations, public.ai_messages TO authenticated;
GRANT ALL ON public.bookings, public.payments, public.ai_conversations, public.ai_messages TO service_role;

-- RLS
ALTER TABLE public.cruise_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sailings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sailing_port_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excursions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cruise_lines_public_read" ON public.cruise_lines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cruise_lines_admin_all" ON public.cruise_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ships_public_read" ON public.ships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ships_admin_all" ON public.ships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ports_public_read" ON public.ports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "ports_admin_all" ON public.ports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "sailings_public_read" ON public.sailings FOR SELECT TO anon, authenticated USING (is_published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "sailings_admin_all" ON public.sailings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "port_calls_public_read" ON public.sailing_port_calls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "port_calls_admin_all" ON public.sailing_port_calls FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "excursions_public_read" ON public.excursions FOR SELECT TO anon, authenticated USING (is_published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "excursions_admin_all" ON public.excursions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "bookings_own_select" ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bookings_own_insert" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_own_update" ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bookings_admin_delete" ON public.bookings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "payments_own_select" ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "payments_own_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_conv_own" ON public.ai_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_msg_own" ON public.ai_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_cruise_lines_updated BEFORE UPDATE ON public.cruise_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_ships_updated BEFORE UPDATE ON public.ships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_ports_updated BEFORE UPDATE ON public.ports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_sailings_updated BEFORE UPDATE ON public.sailings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_port_calls_updated BEFORE UPDATE ON public.sailing_port_calls FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_excursions_updated BEFORE UPDATE ON public.excursions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED DATA ============
INSERT INTO public.cruise_lines (id, name, slug, description) VALUES
 ('11111111-0000-0000-0000-000000000001','Aurelia Cruises','aurelia-cruises','Refined small-ship voyages across the Mediterranean and Adriatic.'),
 ('11111111-0000-0000-0000-000000000002','Meridian Lines','meridian-lines','Classic ocean liners with a modern sense of comfort.'),
 ('11111111-0000-0000-0000-000000000003','Azure Voyages','azure-voyages','Caribbean and Atlantic sailings with an emphasis on shore time.'),
 ('11111111-0000-0000-0000-000000000004','Northern Star Cruises','northern-star-cruises','Expedition-styled journeys through the fjords and Baltic.');

INSERT INTO public.ships (id, cruise_line_id, name, slug, capacity, year_built, description) VALUES
 ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','MS Aurelia','ms-aurelia',930,2019,'An intimate ship with teak decks and a two-storey observation lounge.'),
 ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','MS Serenissima','ms-serenissima',740,2021,'Built for the Adriatic, with shallow draft for small harbours.'),
 ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002','MV Meridian Grace','mv-meridian-grace',2100,2016,'A full-size liner with promenade decks and a grand atrium.'),
 ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','MV Meridian Dawn','mv-meridian-dawn',1980,2013,'A well-loved liner known for its long Atlantic crossings.'),
 ('22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003','Azure Pearl','azure-pearl',1450,2020,'Bright, open decks designed for warm-water itineraries.'),
 ('22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000004','Nordkapp Explorer','nordkapp-explorer',560,2022,'Ice-strengthened hull, panoramic lounges, expedition tenders.');

INSERT INTO public.ports (id, name, slug, country, region, description) VALUES
 ('33333333-0000-0000-0000-000000000001','Barcelona','barcelona','Spain','Western Mediterranean','Gaudí, the Gothic Quarter and a harbour a short walk from La Rambla.'),
 ('33333333-0000-0000-0000-000000000002','Palma de Mallorca','palma-de-mallorca','Spain','Western Mediterranean','A sandstone cathedral above a bay of turquoise water.'),
 ('33333333-0000-0000-0000-000000000003','Marseille','marseille','France','Western Mediterranean','Provence begins at the Vieux-Port.'),
 ('33333333-0000-0000-0000-000000000004','Civitavecchia (Rome)','civitavecchia-rome','Italy','Western Mediterranean','The gateway port for Rome, ninety minutes inland.'),
 ('33333333-0000-0000-0000-000000000005','Naples','naples','Italy','Western Mediterranean','Vesuvius, Pompeii and the Amalfi Coast within reach.'),
 ('33333333-0000-0000-0000-000000000006','Dubrovnik','dubrovnik','Croatia','Adriatic','Walled marble streets above the Adriatic.'),
 ('33333333-0000-0000-0000-000000000007','Kotor','kotor','Montenegro','Adriatic','A fjord-like bay ringed by mountains.'),
 ('33333333-0000-0000-0000-000000000008','Santorini','santorini','Greece','Aegean','Caldera cliffs, white villages, volcanic beaches.'),
 ('33333333-0000-0000-0000-000000000009','Mykonos','mykonos','Greece','Aegean','Windmills, whitewashed lanes and Delos across the water.'),
 ('33333333-0000-0000-0000-000000000010','Istanbul','istanbul','Türkiye','Aegean','Two continents, one skyline of domes and minarets.'),
 ('33333333-0000-0000-0000-000000000011','Miami','miami','United States','Caribbean','The busiest cruise gateway in the world.'),
 ('33333333-0000-0000-0000-000000000012','Nassau','nassau','Bahamas','Caribbean','Pastel colonial streets and reef-clear water.'),
 ('33333333-0000-0000-0000-000000000013','St. Thomas','st-thomas','U.S. Virgin Islands','Caribbean','Green hills falling into Magens Bay.'),
 ('33333333-0000-0000-0000-000000000014','Bergen','bergen','Norway','Northern Europe','The Hanseatic wharf and the gateway to the fjords.');

INSERT INTO public.sailings (id, ship_id, name, slug, region, departure_port_id, arrival_port_id, departure_date, arrival_date, nights, starting_price, description) VALUES
 ('44444444-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','Western Mediterranean Classics','western-mediterranean-classics','Western Mediterranean','33333333-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001','2026-09-12','2026-09-19',7,1290.00,'Barcelona, the Balearics, Provence and Rome in a single week.'),
 ('44444444-0000-0000-0000-000000000002','22222222-0000-0000-0000-000000000002','Adriatic Jewels','adriatic-jewels','Adriatic','33333333-0000-0000-0000-000000000006','33333333-0000-0000-0000-000000000006','2026-09-20','2026-09-26',6,1150.00,'Walled cities and mountain bays along the Dalmatian coast.'),
 ('44444444-0000-0000-0000-000000000003','22222222-0000-0000-0000-000000000003','Aegean & Istanbul','aegean-and-istanbul','Aegean','33333333-0000-0000-0000-000000000010','33333333-0000-0000-0000-000000000010','2026-10-03','2026-10-11',8,1620.00,'From the Bosphorus to the caldera of Santorini.'),
 ('44444444-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000005','Eastern Caribbean Escape','eastern-caribbean-escape','Caribbean','33333333-0000-0000-0000-000000000011','33333333-0000-0000-0000-000000000011','2026-11-08','2026-11-15',7,980.00,'Warm water, reef days and colonial harbours.'),
 ('44444444-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000004','Italy & Riviera Voyage','italy-and-riviera-voyage','Western Mediterranean','33333333-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000003','2026-09-27','2026-10-02',5,1080.00,'Rome, Naples and the coast of Provence.'),
 ('44444444-0000-0000-0000-000000000006','22222222-0000-0000-0000-000000000006','Norwegian Fjord Passage','norwegian-fjord-passage','Northern Europe','33333333-0000-0000-0000-000000000014','33333333-0000-0000-0000-000000000014','2026-08-30','2026-09-04',5,1340.00,'Deep water, high cliffs and long northern light.');

INSERT INTO public.sailing_port_calls (sailing_id, port_id, day_number, call_date, arrival_time, departure_time, is_sea_day) VALUES
 -- Western Mediterranean Classics
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',1,'2026-09-12',NULL,'18:00',false),
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000002',2,'2026-09-13','08:00','17:00',false),
 ('44444444-0000-0000-0000-000000000001',NULL,3,'2026-09-14',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000003',4,'2026-09-15','07:30','18:30',false),
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000004',5,'2026-09-16','07:00','19:00',false),
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000005',6,'2026-09-17','08:00','18:00',false),
 ('44444444-0000-0000-0000-000000000001',NULL,7,'2026-09-18',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',8,'2026-09-19','07:00',NULL,false),
 -- Adriatic Jewels
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000006',1,'2026-09-20',NULL,'19:00',false),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000007',2,'2026-09-21','07:00','16:00',false),
 ('44444444-0000-0000-0000-000000000002',NULL,3,'2026-09-22',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000009',4,'2026-09-23','09:00','20:00',false),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000008',5,'2026-09-24','07:00','21:00',false),
 ('44444444-0000-0000-0000-000000000002',NULL,6,'2026-09-25',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000006',7,'2026-09-26','06:30',NULL,false),
 -- Aegean & Istanbul
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000010',1,'2026-10-03',NULL,'17:00',false),
 ('44444444-0000-0000-0000-000000000003',NULL,2,'2026-10-04',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000009',3,'2026-10-05','08:00','18:00',false),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000008',4,'2026-10-06','07:00','20:00',false),
 ('44444444-0000-0000-0000-000000000003',NULL,5,'2026-10-07',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000005',6,'2026-10-08','08:00','18:00',false),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000004',7,'2026-10-09','07:00','19:00',false),
 ('44444444-0000-0000-0000-000000000003',NULL,8,'2026-10-10',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000010',9,'2026-10-11','08:00',NULL,false),
 -- Eastern Caribbean Escape
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000011',1,'2026-11-08',NULL,'16:30',false),
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000012',2,'2026-11-09','08:00','17:00',false),
 ('44444444-0000-0000-0000-000000000004',NULL,3,'2026-11-10',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000013',4,'2026-11-11','07:00','18:00',false),
 ('44444444-0000-0000-0000-000000000004',NULL,5,'2026-11-12',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000012',6,'2026-11-13','09:00','18:00',false),
 ('44444444-0000-0000-0000-000000000004',NULL,7,'2026-11-14',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000004','33333333-0000-0000-0000-000000000011',8,'2026-11-15','07:00',NULL,false),
 -- Italy & Riviera
 ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000004',1,'2026-09-27',NULL,'18:00',false),
 ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000005',2,'2026-09-28','07:30','19:00',false),
 ('44444444-0000-0000-0000-000000000005',NULL,3,'2026-09-29',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000002',4,'2026-09-30','08:00','17:00',false),
 ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000001',5,'2026-10-01','07:00','18:00',false),
 ('44444444-0000-0000-0000-000000000005','33333333-0000-0000-0000-000000000003',6,'2026-10-02','07:00',NULL,false),
 -- Fjords
 ('44444444-0000-0000-0000-000000000006','33333333-0000-0000-0000-000000000014',1,'2026-08-30',NULL,'18:00',false),
 ('44444444-0000-0000-0000-000000000006',NULL,2,'2026-08-31',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000006',NULL,3,'2026-09-01',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000006',NULL,4,'2026-09-02',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000006',NULL,5,'2026-09-03',NULL,NULL,true),
 ('44444444-0000-0000-0000-000000000006','33333333-0000-0000-0000-000000000014',6,'2026-09-04','08:00',NULL,false);

INSERT INTO public.excursions (port_id, title, slug, summary, description, duration_minutes, price, capacity, meeting_point, category, difficulty) VALUES
 ('33333333-0000-0000-0000-000000000001','Gaudí''s Barcelona by Private Coach','gaudi-barcelona-coach','Sagrada Família and Park Güell with skip-the-line entry.','A guided morning through Gaudí''s masterworks, ending at Park Güell with views across the city to the sea.',240,129.00,24,'Pier gangway, Moll Adossat','Culture','Easy'),
 ('33333333-0000-0000-0000-000000000001','Gothic Quarter & Tapas Walk','barcelona-gothic-tapas','Medieval lanes, a cathedral cloister, and five tastings.','A slow walk through the Barri Gòtic with stops at family-run bars for jamón, pan con tomate and cava.',180,89.00,16,'Cruise terminal shuttle stop','Food & Wine','Easy'),
 ('33333333-0000-0000-0000-000000000002','Serra de Tramuntana Scenic Drive','mallorca-tramuntana','Mountain villages, olive terraces and Valldemossa.','A drive along the UNESCO-listed mountain road with time in Valldemossa and a coastal viewpoint at Sa Foradada.',270,115.00,20,'Palma cruise terminal','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000002','Palma Cathedral & Old Town','palma-cathedral-old-town','La Seu, the Almudaina and the sandstone lanes below.','An unhurried morning inside the great rose-windowed cathedral and the royal palace beside it.',150,69.00,25,'Palma cruise terminal','Culture','Easy'),
 ('33333333-0000-0000-0000-000000000003','Aix-en-Provence & Cézanne Country','marseille-aix-cezanne','Plane-tree boulevards, fountains and a painter''s studio.','A half-day in Aix with its market squares, then Cézanne''s preserved studio on the hill above town.',300,139.00,18,'Marseille cruise pier','Culture','Easy'),
 ('33333333-0000-0000-0000-000000000003','Calanques Boat Cruise','marseille-calanques-boat','White limestone inlets and swimming stops.','A catamaran along the Calanques National Park with two anchoring stops in turquoise water.',210,99.00,30,'Vieux-Port, quai des Belges','Adventure','Moderate'),
 ('33333333-0000-0000-0000-000000000004','Rome: Colosseum & Forum','rome-colosseum-forum','Imperial Rome with reserved entry.','A full day in Rome with a guided route through the Colosseum, the Forum and the Palatine Hill.',600,189.00,20,'Civitavecchia terminal coach bay','Culture','Moderate'),
 ('33333333-0000-0000-0000-000000000004','Vatican Museums & St. Peter''s','rome-vatican','The Sistine Chapel and the basilica, early entry.','An early departure to reach the Vatican ahead of the crowds, ending under Michelangelo''s dome.',600,205.00,18,'Civitavecchia terminal coach bay','Culture','Moderate'),
 ('33333333-0000-0000-0000-000000000005','Pompeii & Vesuvius','naples-pompeii-vesuvius','The buried city and the crater rim above it.','Walk the excavated streets of Pompeii, then climb the final path to the crater of Vesuvius.',420,149.00,22,'Naples Stazione Marittima','History','Moderate'),
 ('33333333-0000-0000-0000-000000000005','Amalfi Coast Drive','naples-amalfi-drive','Positano, Amalfi and the cliff road between them.','The coastal corniche with photo stops, free time in Positano and lemon groves above Amalfi.',450,159.00,16,'Naples Stazione Marittima','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000006','Dubrovnik City Walls Walk','dubrovnik-city-walls','Two kilometres of rampart above the old town.','A guided circuit of the walls at opening time, before the heat and the crowds.',150,79.00,15,'Pile Gate','Culture','Moderate'),
 ('33333333-0000-0000-0000-000000000006','Elafiti Islands Sail & Swim','dubrovnik-elafiti-sail','Three islands, lunch aboard, swimming stops.','A wooden boat out to Koločep, Lopud and Šipan with a fish lunch and time on the sand.',360,125.00,28,'Gruž harbour','Adventure','Easy'),
 ('33333333-0000-0000-0000-000000000007','Kotor Bay & Perast by Boat','kotor-perast-boat','The bay, Our Lady of the Rocks, and Perast.','A slow boat across the bay to the island church, then an hour in the baroque village of Perast.',210,89.00,24,'Kotor tender pier','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000007','Lovćen Panorama & Njeguši','kotor-lovcen-njegusi','Twenty-five hairpins to the mountain terrace.','The serpentine road above Kotor, a mausoleum at the summit and smoked ham in Njeguši.',300,109.00,16,'Kotor tender pier','Scenic','Moderate'),
 ('33333333-0000-0000-0000-000000000008','Oia Sunset & Caldera Villages','santorini-oia-sunset','Fira, Oia and the light on the caldera.','An afternoon along the caldera rim, ending in Oia as the light turns.',300,119.00,20,'Old Port tender landing','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000008','Santorini Wine Estates','santorini-wine-estates','Assyrtiko from vines grown in baskets.','Three estates on the volcanic plateau, with tastings of Assyrtiko, Nykteri and Vinsanto.',240,135.00,14,'Athinios port','Food & Wine','Easy'),
 ('33333333-0000-0000-0000-000000000009','Delos Archaeological Island','mykonos-delos','The sacred island, by boat.','A short crossing to Delos and a guided route through the terrace of lions and the ancient theatre.',240,95.00,25,'Mykonos Old Port','History','Moderate'),
 ('33333333-0000-0000-0000-000000000009','Mykonos Beaches & Little Venice','mykonos-beaches','Windmills, waterfront tavernas and a beach stop.','Chora on foot, then time on Platis Gialos with loungers included.',270,85.00,30,'Mykonos cruise pier','Leisure','Easy'),
 ('33333333-0000-0000-0000-000000000010','Sultanahmet: Hagia Sophia & Blue Mosque','istanbul-sultanahmet','The imperial heart of the old city.','Hagia Sophia, the Blue Mosque, the Hippodrome and the Basilica Cistern with a local historian.',300,109.00,20,'Galataport terminal','Culture','Easy'),
 ('33333333-0000-0000-0000-000000000010','Bosphorus Cruise & Spice Bazaar','istanbul-bosphorus-bazaar','Palaces from the water, then the bazaar.','A private boat up the Bosphorus past Dolmabahçe and the fortresses, then the Spice Bazaar.',240,95.00,26,'Galataport terminal','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000012','Blue Lagoon Island Beach Day','nassau-blue-lagoon','Private island, calm water, lunch included.','A ferry to Blue Lagoon Island with beach chairs, kayaks and a buffet lunch.',330,119.00,40,'Prince George Wharf','Leisure','Easy'),
 ('33333333-0000-0000-0000-000000000012','Nassau Reef Snorkel','nassau-reef-snorkel','Two reef stops with gear and guides.','A catamaran to two shallow reefs with instruction for first-time snorkellers.',180,79.00,24,'Prince George Wharf','Adventure','Moderate'),
 ('33333333-0000-0000-0000-000000000013','St. Thomas Island Drive & Magens Bay','st-thomas-magens-bay','Mountain Top viewpoint and the famous bay.','A scenic drive over the ridge with a stop at Mountain Top, then beach time at Magens Bay.',240,89.00,30,'Havensight Dock','Scenic','Easy'),
 ('33333333-0000-0000-0000-000000000014','Fløibanen Funicular & Bryggen Walk','bergen-floibanen-bryggen','The old wharf and the mountain above it.','The funicular to Mount Fløyen for the harbour panorama, then the Hanseatic warehouses of Bryggen.',180,75.00,25,'Bergen cruise terminal','Culture','Easy');
