-- Next scheduled departures for a Rapid Rail stop.
--
-- Rapid Rail is FREQUENCY-BASED: "rapid-rail".stop_times stores one template trip
-- per service/direction, and "rapid-rail".frequencies defines headway windows
-- (e.g. every 180s peak / 300s off-peak). So a real "next departure" must expand
-- the frequency windows rather than read fixed times.
--
-- The other agencies (ktmb / rapid-bus / rapid-mrt) broadcast live positions, so
-- they don't use this function — only rail needs a static-schedule lookup.
--
-- Run once on each DB (local + prod), like get_realtime_geojson:
--   psql "$DATABASE_URL" -f sql/arrivals.sql

CREATE OR REPLACE FUNCTION public.get_rail_arrivals(
  p_stop_id text,
  p_limit   int DEFAULT 4
)
RETURNS TABLE (
  route_short_name text,
  trip_headsign    text,
  departure        interval
)
LANGUAGE sql
STABLE
AS $$
  WITH n AS (
    SELECT (now() AT TIME ZONE 'Asia/Kuala_Lumpur') AS ts
  ),
  active AS (  -- services running today (weekday + date window). calendar weekday
               -- columns use the `availability` enum, not booleans.
    SELECT c.service_id
    FROM "rapid-rail".calendar c, n
    WHERE (SELECT ts::date FROM n) BETWEEN c.start_date AND c.end_date
      AND CASE extract(dow FROM (SELECT ts FROM n))
            WHEN 0 THEN c.sunday
            WHEN 1 THEN c.monday
            WHEN 2 THEN c.tuesday
            WHEN 3 THEN c.wednesday
            WHEN 4 THEN c.thursday
            WHEN 5 THEN c.friday
            WHEN 6 THEN c.saturday
          END = 'available'
  ),
  stop_trips AS (  -- trips serving this stop today + the stop's offset from trip start
    SELECT st.trip_id,
           r.route_short_name AS rsn,
           t.trip_headsign    AS headsign,
           (st.departure_time - st.trip_start_time) AS off_iv
    FROM "rapid-rail".stop_times st
    JOIN "rapid-rail".trips  t ON t.trip_id  = st.trip_id
    JOIN "rapid-rail".routes r ON r.route_id = t.route_id
    WHERE st.stop_id = p_stop_id
      AND t.service_id IN (SELECT service_id FROM active)
  ),
  expanded AS (  -- expand each frequency window into individual departures
    SELECT s.rsn, s.headsign,
           (f.start_time + make_interval(secs => g * f.headway_secs) + s.off_iv) AS dep
    FROM stop_trips s
    JOIN "rapid-rail".frequencies f ON f.trip_id = s.trip_id
    CROSS JOIN LATERAL generate_series(
      0,
      GREATEST(0, floor(extract(epoch FROM (f.end_time - f.start_time)) / f.headway_secs)::int - 1)
    ) AS g
  )
  SELECT rsn, headsign, dep
  FROM expanded, n
  WHERE dep >= ((SELECT ts FROM n)::time)::interval
  ORDER BY dep
  LIMIT p_limit;
$$;
