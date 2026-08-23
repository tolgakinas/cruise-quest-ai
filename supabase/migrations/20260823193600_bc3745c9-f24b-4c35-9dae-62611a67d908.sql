ALTER TABLE public.import_sources
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'timetable',
  ADD COLUMN IF NOT EXISTS ship_slug text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS import_sources_url_key ON public.import_sources (url);
CREATE INDEX IF NOT EXISTS import_sources_queue_idx ON public.import_sources (kind, is_active, last_run_at);