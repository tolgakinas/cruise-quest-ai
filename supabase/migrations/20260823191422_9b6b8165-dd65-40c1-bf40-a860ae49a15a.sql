CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('refresh-cruise-timetables')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-cruise-timetables');

SELECT cron.schedule(
  'refresh-cruise-timetables',
  '15 3 * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://project--98d9af66-ff87-4520-aec6-519e078bf601.lovable.app/api/public/import-timetables',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Wuh7wOahsAutOhOaw3hakQ_6Zl4XeMQ"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);