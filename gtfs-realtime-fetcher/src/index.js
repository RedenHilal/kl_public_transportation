import protobuf from 'protobufjs';
import pg from 'pg';
import http from 'http';

const GTFS_RT_PROTO = `
syntax = "proto2";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}
message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional int32 incrementality = 2;
  optional uint64 timestamp = 3;
}
message FeedEntity {
  required string id = 1;
  optional bool is_deleted = 2;
  optional TripUpdate trip_update = 3;
  optional VehiclePosition vehicle = 4;
  optional Alert alert = 5;
}
message TripUpdate {
  optional TripDescriptor trip = 1;
}
message Alert {
  repeated TimeRange active_period = 1;
  repeated EntitySelector informed_entity = 5;
  optional Cause cause = 6 [default = UNKNOWN_CAUSE];
  optional Effect effect = 7 [default = UNKNOWN_EFFECT];
  optional TranslatedString url = 8;
  optional TranslatedString header_text = 10;
  optional TranslatedString description_text = 11;

  enum Cause {
    UNKNOWN_CAUSE = 1;
    OTHER_CAUSE = 2;
    TECHNICAL_PROBLEM = 3;
    STRIKE = 4;
    DEMONSTRATION = 5;
    ACCIDENT = 6;
    HOLIDAY = 7;
    WEATHER = 8;
    MAINTENANCE = 9;
    CONSTRUCTION = 10;
    POLICE_ACTIVITY = 11;
    MEDICAL_EMERGENCY = 12;
  }
  enum Effect {
    NO_SERVICE = 1;
    REDUCED_SERVICE = 2;
    SIGNIFICANT_DELAYS = 3;
    DETOUR = 4;
    ADDITIONAL_SERVICE = 5;
    MODIFIED_SERVICE = 6;
    OTHER_EFFECT = 7;
    UNKNOWN_EFFECT = 8;
    STOP_MOVED = 9;
  }
}
message TimeRange {
  optional uint64 start = 1;
  optional uint64 end = 2;
}
message EntitySelector {
  optional string agency_id = 1;
  optional string route_id = 2;
  optional string stop_id = 5;
}
message TranslatedString {
  repeated Translation translation = 1;
}
message Translation {
  required string text = 1;
  optional string language = 2;
}
message VehiclePosition {
  optional TripDescriptor trip = 1;
  optional Position position = 2;
  optional uint32 current_stop_sequence = 3;
  optional uint64 timestamp = 5;
  optional string stop_id = 7;
  optional VehicleDescriptor vehicle = 8;
}
message TripDescriptor {
  optional string trip_id = 1;
  optional string start_time = 2;
  optional string start_date = 3;
  optional string route_id = 5;
  optional uint32 direction_id = 6;
}
message VehicleDescriptor {
  optional string id = 1;
  optional string label = 2;
  optional string license_plate = 3;
}
message Position {
  required float latitude = 1;
  required float longitude = 2;
  optional float bearing = 3;
  optional float speed = 5;
}
`;

const root = protobuf.parse(GTFS_RT_PROTO, { keepCase: true });
const FeedMessage = root.root.lookupType('transit_realtime.FeedMessage');

const ENDPOINTS = [
  {
    url: 'https://api.data.gov.my/gtfs-realtime/vehicle-position/ktmb',
    alerts_url: 'https://api.data.gov.my/gtfs-realtime/service-alerts/ktmb',
    agency: 'ktmb',
  },
  {
    url: 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl',
    alerts_url: 'https://api.data.gov.my/gtfs-realtime/service-alerts/prasarana?category=rapid-bus-kl',
    agency: 'rapid-bus',
  },
  {
    url: 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-mrtfeeder',
    alerts_url: 'https://api.data.gov.my/gtfs-realtime/service-alerts/prasarana?category=rapid-bus-mrtfeeder',
    agency: 'rapid-mrt',
  },
];

const POLL_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS  = 15_000;
const STALE_SECONDS    = 90;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  statement_timeout: 10_000,
});

function decodeFeed(buffer, agency) {
  const feed = FeedMessage.decode(new Uint8Array(buffer));
  const vehicles = [];

  for (const entity of feed.entity) {
    if (!entity.vehicle || !entity.vehicle.position) continue;

    const v = entity.vehicle;
    const lat = v.position.latitude;
    const lon = v.position.longitude;
    if (lat == null || lon == null) continue;

    const nowSeconds = Math.floor(Date.now() / 1000);
    let ts =
      typeof v.timestamp === 'number'
        ? v.timestamp
        : v.timestamp?.toNumber?.() ?? Number(v.timestamp ?? 0);
    
    // Sanitize: If timestamp is in future or > 1 hour old, use current time
    if (ts > nowSeconds + 60 || ts < nowSeconds - 3600) {
      ts = nowSeconds;
    }

    vehicles.push({
      agency_name:   agency,
      entity_id:     entity.id,
      vehicle_id:    v.vehicle?.id ?? null,
      vehicle_label: v.vehicle ? (v.vehicle.label || v.vehicle.license_plate) : null,
      route_id:      v.trip?.route_id ?? null,
      trip_id:       v.trip?.trip_id ?? null,
      bearing:       v.position.bearing ?? null,
      speed:         v.position.speed ?? null,
      timestamp:     ts,
      stop_sequence: v.current_stop_sequence ?? null,
      stop_id:       v.stop_id ?? null,
      longitude:     lon,
      latitude:      lat,
    });
  }

  return vehicles;
}

// Per-feed status from the most recent poll, keyed by agency. Exposed on the
// /realtime.geojson response so the UI can tell "feed is empty" (fresh header,
// zero vehicles) apart from "feed unavailable" (fetch/decode failed).
const feedStatus = {};
function setFeedStatus(agency, fields) {
  feedStatus[agency] = { agency, fetched_at: new Date().toISOString(), ...fields };
}

// KTMB live vehicles carry no route_id, but their trip_id maps to a line via
// ktmb.trips -> ktmb.routes. That data is static GTFS (tiny: ~300 trips, 9
// routes), so cache the lookup and refresh occasionally to pick up a feed reload.
const KTMB_ROUTES_TTL_MS = 30 * 60 * 1000;
let ktmbTripRoutes = null;        // Map(trip_id -> { short, long })
let ktmbTripRoutesAt = 0;
async function getKtmbTripRoutes() {
  if (ktmbTripRoutes && Date.now() - ktmbTripRoutesAt < KTMB_ROUTES_TTL_MS) return ktmbTripRoutes;
  try {
    const { rows } = await pool.query(
      `SELECT t.trip_id, r.route_short_name, r.route_long_name
         FROM ktmb.trips t JOIN ktmb.routes r ON r.route_id = t.route_id`
    );
    const map = new Map();
    for (const row of rows) map.set(row.trip_id, { short: row.route_short_name, long: row.route_long_name });
    ktmbTripRoutes = map;
    ktmbTripRoutesAt = Date.now();
  } catch (err) {
    console.error('[GTFS-RT] ktmb trip->route lookup failed:', err.message);
    if (!ktmbTripRoutes) ktmbTripRoutes = new Map(); // avoid retry storm; reuse last good otherwise
  }
  return ktmbTripRoutes;
}

async function fetchEndpoint(endpoint) {
  try {
    const resp = await fetch(endpoint.url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (resp.status === 429) {
      console.warn(`[${endpoint.agency}] Rate limited (429), skipping cycle`);
      setFeedStatus(endpoint.agency, { ok: false, error: 'rate_limited', vehicles: 0, feed_timestamp: null });
      return [];
    }
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const buffer = await resp.arrayBuffer();
    const feed = FeedMessage.decode(new Uint8Array(buffer));
    const feedTs = feed.header?.timestamp ? Number(feed.header.timestamp) : null;
    const vehicles = decodeFeed(buffer, endpoint.agency);
    console.log(
      `[${endpoint.agency}] ${vehicles.length} vehicles at ${new Date().toISOString()}`
    );
    setFeedStatus(endpoint.agency, { ok: true, error: null, vehicles: vehicles.length, feed_timestamp: feedTs });
    return vehicles;
  } catch (e) {
    console.error(`[${endpoint.agency}] Vehicle fetch failed:`, e.message);
    setFeedStatus(endpoint.agency, { ok: false, error: e.message, vehicles: 0, feed_timestamp: null });
    return [];
  }
}

async function fetchAlerts(endpoint) {
  try {
    const resp = await fetch(endpoint.alerts_url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return [];
    const buffer = await resp.arrayBuffer();
    const feed = FeedMessage.decode(new Uint8Array(buffer));
    return feed.entity.filter(e => e.alert).map(e => ({
      id: e.id,
      agency_name: endpoint.agency,
      header: e.alert.header_text?.translation?.[0]?.text || '',
      description: e.alert.description_text?.translation?.[0]?.text || '',
      cause: e.alert.cause || 'UNKNOWN_CAUSE',
      effect: e.alert.effect || 'UNKNOWN_EFFECT',
      start: e.alert.active_period?.[0]?.start || null,
      end: e.alert.active_period?.[0]?.end || null,
    }));
  } catch (e) {
    console.error(`[${endpoint.agency}] Alert fetch failed:`, e.message);
    return [];
  }
}

async function pollCycle() {
  const cycleStart = new Date();

  const results = await Promise.allSettled(ENDPOINTS.map(fetchEndpoint));
  const alertResults = await Promise.allSettled(ENDPOINTS.map(fetchAlerts));

  const allVehicles = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
  const allAlerts = alertResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update Alerts
    await client.query('DELETE FROM public.service_alerts');
    for (const a of allAlerts) {
      await client.query(
        `INSERT INTO public.service_alerts (id, agency_name, alert_header, alert_description, cause, effect, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [a.id, a.agency_name, a.header, a.description, a.cause, a.effect, a.start, a.end]
      );
    }

    // Update Vehicles
    for (const v of allVehicles) {
      await client.query(
        `INSERT INTO public.realtime_vehicle_positions
           (agency_name, entity_id, vehicle_id, vehicle_label,
            route_id, trip_id, bearing, speed, timestamp,
            stop_sequence, stop_id, geom, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                 ST_SetSRID(ST_MakePoint($12, $13), 4326), NOW())
         ON CONFLICT (agency_name, entity_id)
         DO UPDATE SET
           vehicle_id    = EXCLUDED.vehicle_id,
           vehicle_label = EXCLUDED.vehicle_label,
           route_id      = EXCLUDED.route_id,
           trip_id       = EXCLUDED.trip_id,
           bearing       = EXCLUDED.bearing,
           speed         = EXCLUDED.speed,
           timestamp     = EXCLUDED.timestamp,
           stop_sequence = EXCLUDED.stop_sequence,
           stop_id       = EXCLUDED.stop_id,
           geom          = EXCLUDED.geom,
           updated_at    = NOW()`,
        [
          v.agency_name, v.entity_id, v.vehicle_id, v.vehicle_label,
          v.route_id, v.trip_id, v.bearing, v.speed, v.timestamp,
          v.stop_sequence, v.stop_id, v.longitude, v.latitude,
        ]
      );
    }


    const staleThreshold = new Date(Date.now() - STALE_SECONDS * 1000);
    const deleteResult = await client.query(
      `DELETE FROM public.realtime_vehicle_positions WHERE updated_at < $1`,
      [staleThreshold]
    );

    await client.query('COMMIT');
    if (deleteResult.rowCount > 0) console.log(`[GTFS-RT] Removed ${deleteResult.rowCount} stale positions`);
    console.log(`[GTFS-RT] Cycle complete: ${allVehicles.length} vehicles, ${allAlerts.length} alerts`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[GTFS-RT] DB transaction failed:', err.message);
  } finally {
    client.release();
  }

  scheduleNext(cycleStart);
}

function scheduleNext(cycleStart) {
  const elapsed = Date.now() - cycleStart.getTime();
  const delay = Math.max(MIN_INTERVAL_MS, POLL_INTERVAL_MS - elapsed);
  setTimeout(pollCycle, delay);
}

// Lightweight HTTP endpoint that serves the whole live fleet as one GeoJSON
// FeatureCollection (public.get_realtime_geojson). The frontend renders this as
// a single GeoJSON source instead of vector tiles, so vehicle positions are
// consistent across zoom levels and don't flicker on refresh.
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3001;
const httpServer = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

  if (url === '/realtime.geojson') {
    try {
      const { rows } = await pool.query('SELECT public.get_realtime_geojson() AS fc');
      const fc = rows[0].fc || { type: 'FeatureCollection', features: [] };

      // KTMB trains have no route_id; resolve their line from trip_id so the UI
      // can show "Ipoh Line", the destination, etc. (partial — GTFS-RT includes
      // trips the static feed doesn't, which simply stay unresolved).
      const ktmbRoutes = await getKtmbTripRoutes();
      for (const f of fc.features || []) {
        const p = f.properties;
        if (p && p.agency_name === 'ktmb') {
          const line = ktmbRoutes.get(p.trip_id);
          if (line) {
            p.route_short_name = line.short;
            p.route_long_name = line.long;
          } else if (/^(weekday|weekend|saturday|sunday)_/i.test(p.trip_id || '')) {
            // Komuter trip missing from the static feed (live numbers outrun it).
            // The service-day prefix still reliably marks it as KTM Komuter.
            p.route_short_name = 'KTM Komuter';
          }
        }
      }

      // Non-standard extra member; GeoJSON consumers ignore it, the UI reads it
      // to surface empty/unavailable feeds.
      fc.feeds = Object.values(feedStatus);
      res.writeHead(200, { 'Content-Type': 'application/geo+json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(fc));
    } catch (err) {
      console.error('[GTFS-RT] /realtime.geojson failed:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"type":"FeatureCollection","features":[]}');
    }
    return;
  }
  // Next scheduled departures for a stop. Only Rapid Rail uses this (it's
  // frequency-based and has no realtime feed); other agencies broadcast live
  // positions, so they return an empty list. Backed by public.get_rail_arrivals.
  if (url === '/arrivals') {
    const params = new URLSearchParams((req.url || '').split('?')[1] || '');
    const stopId = params.get('stop_id');
    const agency = params.get('agency');
    const limit = Math.min(Math.max(Number(params.get('limit')) || 4, 1), 10);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    if (!stopId || agency !== 'rapid-rail') { res.end(JSON.stringify({ stop_id: stopId, arrivals: [] })); return; }
    try {
      const { rows } = await pool.query('SELECT * FROM public.get_rail_arrivals($1, $2)', [stopId, limit]);
      const arrivals = rows.map((r) => ({
        route: r.route_short_name,
        headsign: r.trip_headsign,
        // departure comes back as an interval object {hours,minutes,...}; format HH:MM.
        time: `${String((r.departure?.hours ?? 0) % 24).padStart(2, '0')}:${String(r.departure?.minutes ?? 0).padStart(2, '0')}`,
      }));
      res.end(JSON.stringify({ stop_id: stopId, arrivals }));
    } catch (err) {
      console.error('[GTFS-RT] /arrivals failed:', err.message);
      res.end(JSON.stringify({ stop_id: stopId, arrivals: [] }));
    }
    return;
  }
  if (url === '/healthz') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(404); res.end('Not found');
});
httpServer.listen(HTTP_PORT, () => console.log(`[GTFS-RT] HTTP endpoint on :${HTTP_PORT} (/realtime.geojson)`));

console.log('[GTFS-RT] Connecting to database...');
pool.query('SELECT 1').then(() => {
  console.log('[GTFS-RT] Connected. Starting poll cycle.');
  pollCycle();
}).catch((err) => {
  console.error('[GTFS-RT] Database connection failed:', err.message);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[GTFS-RT] SIGTERM received, shutting down...');
  await pool.end().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[GTFS-RT] SIGINT received, shutting down...');
  await pool.end().catch(() => {});
  process.exit(0);
});
