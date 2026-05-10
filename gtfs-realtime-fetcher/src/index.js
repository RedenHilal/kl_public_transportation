import protobuf from 'protobufjs';
import pg from 'pg';

const GTFS_RT_PROTO = `
syntax = "proto2";
package transit_realtime;

message FeedMessage {
  required FeedHeader header = 1;
  repeated FeedEntity entity = 2;
}
message FeedHeader {
  required string gtfs_realtime_version = 1;
  optional uint64 timestamp = 2;
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
message Alert {}
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
    agency: 'ktmb',
  },
  {
    url: 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl',
    agency: 'rapid-bus',
  },
  {
    url: 'https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-mrtfeeder',
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

    const ts =
      typeof v.timestamp === 'number'
        ? v.timestamp
        : v.timestamp?.toNumber?.() ?? Number(v.timestamp ?? 0);

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
      longitude:     lon,
      latitude:      lat,
    });
  }

  return vehicles;
}

async function fetchEndpoint(endpoint) {
  const resp = await fetch(endpoint.url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (resp.status === 429) {
    console.warn(`[${endpoint.agency}] Rate limited (429), skipping cycle`);
    return [];
  }
  if (!resp.ok) {
    throw new Error(`[${endpoint.agency}] HTTP ${resp.status}`);
  }

  const buffer = await resp.arrayBuffer();
  const vehicles = decodeFeed(buffer, endpoint.agency);
  console.log(
    `[${endpoint.agency}] ${vehicles.length} vehicles at ${new Date().toISOString()}`
  );
  return vehicles;
}

async function pollCycle() {
  const cycleStart = new Date();

  const results = await Promise.allSettled(
    ENDPOINTS.map(fetchEndpoint)
  );

  const allVehicles = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allVehicles.push(...result.value);
    } else {
      console.error('Fetch failed:', result.reason?.message ?? result.reason);
    }
  }

  if (allVehicles.length === 0) {
    scheduleNext(cycleStart);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const v of allVehicles) {
      await client.query(
        `INSERT INTO public.realtime_vehicle_positions
           (agency_name, entity_id, vehicle_id, vehicle_label,
            route_id, trip_id, bearing, speed, timestamp,
            stop_sequence, geom, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 ST_SetSRID(ST_MakePoint($11, $12), 4326), NOW())
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
           geom          = EXCLUDED.geom,
           updated_at    = NOW()`,
        [
          v.agency_name, v.entity_id, v.vehicle_id, v.vehicle_label,
          v.route_id, v.trip_id, v.bearing, v.speed, v.timestamp,
          v.stop_sequence, v.longitude, v.latitude,
        ]
      );
    }

    const staleThreshold = new Date(Date.now() - STALE_SECONDS * 1000);
    const deleteResult = await client.query(
      `DELETE FROM public.realtime_vehicle_positions WHERE updated_at < $1`,
      [staleThreshold]
    );

    await client.query('COMMIT');

    if (deleteResult.rowCount > 0) {
      console.log(`[GTFS-RT] Removed ${deleteResult.rowCount} stale positions`);
    }
    console.log(`[GTFS-RT] Cycle complete: ${allVehicles.length} positions written`);
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
