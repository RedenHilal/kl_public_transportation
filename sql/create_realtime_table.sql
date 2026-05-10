-- GTFS-RT Realtime Vehicle Positions Table
-- Stores the latest known position per vehicle per agency.
-- Populated by the gtfs-realtime-fetcher service.

CREATE TABLE IF NOT EXISTS public.realtime_vehicle_positions (
    id            BIGSERIAL PRIMARY KEY,
    agency_name   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    vehicle_id    TEXT,
    vehicle_label TEXT,
    route_id      TEXT,
    trip_id       TEXT,
    bearing       REAL,
    speed         REAL,
    timestamp     BIGINT,
    stop_sequence INTEGER,
    geom          geometry(Point, 4326) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (agency_name, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_realtime_vehicle_positions_geom
    ON public.realtime_vehicle_positions USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_realtime_vehicle_positions_agency
    ON public.realtime_vehicle_positions (agency_name);

CREATE INDEX IF NOT EXISTS idx_realtime_vehicle_positions_updated_at
    ON public.realtime_vehicle_positions (updated_at);

ANALYZE public.realtime_vehicle_positions;
