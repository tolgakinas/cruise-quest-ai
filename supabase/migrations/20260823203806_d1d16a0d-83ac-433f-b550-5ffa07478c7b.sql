CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'shoreex-catalog-sync',
  '20 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--98d9af66-ff87-4520-aec6-519e078bf601.lovable.app/api/public/import-shoreex-catalog',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Wuh7wOahsAutOhOaw3hakQ_6Zl4XeMQ"}'::jsonb,
    body := '{"offset": 0, "limit": 40, "years": [2026, 2027, 2028]}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'shoreex-itinerary-drain',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--98d9af66-ff87-4520-aec6-519e078bf601.lovable.app/api/public/import-shoreex',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_Wuh7wOahsAutOhOaw3hakQ_6Zl4XeMQ"}'::jsonb,
    body := '{"limit": 40}'::jsonb
  );
  $$
);