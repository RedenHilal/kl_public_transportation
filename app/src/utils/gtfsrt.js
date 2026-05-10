import protobuf from 'protobufjs';

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

export function decodeVehiclePositions(arrayBuffer) {
  const feed = FeedMessage.decode(new Uint8Array(arrayBuffer));

  const features = [];
  feed.entity.forEach((entity) => {
    if (!entity.vehicle || !entity.vehicle.position) return;
    const v = entity.vehicle;
    const lat = v.position.latitude;
    const lon = v.position.longitude;
    if (lat == null || lon == null) return;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        id: entity.id,
        vehicleId: v.vehicle ? v.vehicle.id : null,
        vehicleLabel: v.vehicle ? (v.vehicle.label || v.vehicle.license_plate) : null,
        routeId: v.trip ? v.trip.route_id : null,
        tripId: v.trip ? v.trip.trip_id : null,
        bearing: v.position.bearing ?? v.bearing ?? null,
        speed: v.position.speed ?? null,
        timestamp: typeof v.timestamp === 'number' ? v.timestamp : v.timestamp?.toNumber?.() ?? Number(v.timestamp ?? 0),
        stopSequence: v.current_stop_sequence || null,
      },
    });
  });

  return { type: 'FeatureCollection', features };
}
