# Klang Valley Public Transportation Map

An interactive web GIS platform that visualizes **Klang Valley / Malaysia public transit** on a real-time map. Covers Rapid KL bus, Rapid KL rail (LRT, MRT, Monorail, BRT), MRT feeder buses, and KTMB intercity/Komuter rail — with a **live vehicle tracking layer** and service alerts.

![Map screenshot](https://img.shields.io/badge/status-active-brightgreen)

## Features

- 🗺️ **Interactive map** — Pan and zoom across the Klang Valley transit network on a CARTO Voyager basemap
- 🚌 **Multi-agency coverage** — Rapid KL buses, LRT/MRT/Monorail/BRT, MRT feeder buses, and KTMB
- 🟢 **Live vehicle tracking** — Real-time bus and train positions updated every 15 seconds, color-coded by route
- 🚨 **Service alerts** — Active disruptions and advisories displayed prominently
- 🚉 **Stop information** — Click any stop to see its name, code, and serving routes
- 🚆 **Rapid Rail schedules** — Click an LRT/MRT/Monorail station for next-departure times
- 🔍 **Search stops** — Find stops by name across the entire loaded area
- 📍 **Geolocation** — Locate yourself on the map
- 🌓 **Dark mode** — Toggle between light and dark themes
- 📱 **Mobile-responsive** — Collapsible sidebar with layer toggles

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | [React 19](https://react.dev/) + [Vite](https://vite.dev/) + [MapLibre GL JS](https://maplibre.org/) via [`react-map-gl`](https://visgl.github.io/react-map-gl/) |
| **Tile Server** | [Martin](https://maplibre.org/martin/) — serves vector tiles (MVT/GeoJSON) from PostGIS |
| **Database** | PostgreSQL 14 + [PostGIS 3.2](https://postgis.net/) |
| **Realtime** | Node.js service polling [data.gov.my](https://data.gov.my) GTFS-Realtime feeds |
| **Infrastructure** | Docker Compose (dev), nginx (static serving), deployed on VPS |

## Architecture

```
┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│   Frontend   │───▶│   Martin Tile    │───▶│  PostGIS   │
│  (React SPA) │    │   Server :3000   │    │  Database  │
│              │    │                  │    └────────────┘
│  MapLibre GL │    │  transit_routes  │          ▲
│  + react-map │    │  transit_stops   │          │
│        │     │    │  get_realtime_   │   ┌─────┴──────────┐
│        │     │    │    geojson()     │   │ GTFS-Realtime   │
│        ▼     │    └─────────────────┘   │ Fetcher (Node)  │
│  nginx :8000 │                           │ polls data.gov.my│
│  (static)    │                           └─────────────────┘
└──────────────┘
```

The frontend fetches:
- **Vector tiles** from Martin (routes, stops) for the interactive map layers
- **Real-time vehicle positions** from the fetcher's GeoJSON endpoint
- **Service alerts** from Martin every 60 seconds
- **Rapid Rail departure times** from the fetcher's arrivals endpoint

## Repository Layout

```
├── docker-compose.yml           # Martin (:3000) + nginx web (:8000) + PostGIS (dev)
├── .env.example                 # DATABASE_URL, WEB_PORT
├── .gitignore
├── app/                         # Vite + React 19 + MapLibre frontend
│   ├── src/
│   │   ├── App.jsx              # Map shell, sources, popups, refresh loop
│   │   ├── components/
│   │   │   ├── Map/RealtimeLayers.jsx  # Double-buffered realtime vehicle layers
│   │   │   ├── Sidebar.jsx            # Layer toggles, search, geolocate, dark mode
│   │   │   ├── Legend.jsx             # Route color legend
│   │   │   ├── ServiceAlerts.jsx      # Active service disruptions
│   │   │   └── Toast.jsx              # Notification toasts
│   │   ├── hooks/
│   │   │   ├── useRouteMetadata.js    # Route list with colors
│   │   │   ├── useRealtime.js         # Live vehicle polling
│   │   │   ├── useRealtimeBuses.js    # Legacy realtime hook
│   │   │   ├── useVehicleInterpolation.js  # Smooth vehicle animation
│   │   │   ├── useRouteGeometry.js    # Full route line geometry
│   │   │   └── useAnimatedRealtime.js # Animated realtime layer hook
│   │   ├── constants/
│   │   │   ├── transit.js       # Layer definitions, interactive layers, asset map
│   │   │   ├── config.js        # Tile server / API endpoint URLs
│   │   │   └── colors.js        # Agency and route color palette
│   │   └── utils/
│   │       ├── gtfsrt.js        # GTFS-RT protobuf helpers
│   │       ├── polyline.js      # Google Encoded Polyline decoder
│   │       └── marquee.js       # Auto-scroll for truncated popup text
│   ├── vite.config.js
│   └── package.json
├── martin/
│   └── martin.yaml              # Martin config — publishes tables + SQL function
├── sql/
│   ├── setup_views.sql          # Builds public.transit_routes / transit_stops views
│   └── arrivals.sql             # Scheduled departure queries
├── gtfs-realtime-fetcher/       # Node.js GTFS-RT poller
│   └── src/index.js             # Polls data.gov.my, upserts into PostGIS
└── deploy.sh                    # Build app + rsync to production server
```

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- [Node.js](https://nodejs.org/) 18+
- A PostGIS database (remote, or local via Docker with `--profile dev`)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/kl_public_transportation.git
   cd kl_public_transportation
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `DATABASE_URL` — your PostGIS connection string
   - `WEB_PORT` — web server port (default `8000`)

3. **Start the tile server and web server**
   ```bash
   docker compose up
   ```
   This starts Martin (`:3000`) and nginx (`:${WEB_PORT}`).

   For local development with a local PostGIS instance:
   ```bash
   docker compose --profile dev up
   ```
   This also spins up a PostGIS 14-3.2 container (`:5433`).

4. **Run the frontend (dev mode)**
   ```bash
   cd app
   npm install
   npm run dev
   ```
   This starts a Vite dev server (default `:5173`) with hot module replacement.

   > The frontend's tile and API endpoints are hard-coded to the production server
   > (`https://yuellen.my.id/martin/...`). For local development, create
   > `app/.env.development` with:
   > ```
   > VITE_MARTIN_URL=http://localhost:3000
   > VITE_REALTIME_URL=http://localhost:8004/realtime.geojson
   > VITE_ARRIVALS_URL=http://localhost:8004/arrivals
   > VITE_ROUTE_URL=http://localhost:8004/route_geojson
   > ```

5. **Run the realtime fetcher (optional, needs DB access)**
   ```bash
   node gtfs-realtime-fetcher/src/index.js
   ```
   Polls data.gov.my GTFS-RT feeds every 30 seconds and populates the
   `realtime_vehicle_positions` and `service_alerts` tables.

### Building for Production

```bash
cd app && npm run build
```

Output goes to `app/dist/`, served by nginx via Docker Compose.

## Database

**PostgreSQL 14 + PostGIS 3.2** — database `gis_malay`.

### Schemas

| Schema | Contents |
|--------|----------|
| `rapid-bus` | Rapid KL bus GTFS feed (125 routes, ~3,760 stops) |
| `rapid-rail` | Rapid KL urban rail: AGL, SPL, KJL, KGL, PYL, MRL, BRT (7 routes) |
| `rapid-mrt` | MRT feeder buses, `route_type = 3` (92 routes) |
| `ktmb` | KTMB intercity (ETS, Ekspres) + Komuter rail (9 routes) |
| `public` | Serving views, realtime tables, and PostGIS metadata |

> The `rapid-*` schema names contain hyphens and **must be double-quoted** in SQL:
> ```sql
> SELECT * FROM "rapid-bus".routes;
> ```

### Serving Views

The frontend reads two materialized views in the `public` schema, published by Martin:

- **`transit_routes`** — Route line geometries (LineString, 4326) unioned from rapid-bus, rapid-rail, and rapid-mrt shapes, with brand colors. ~265 rows.
- **`transit_stops`** — Stop points (Point, 4326) unioned from all four agencies. ~6,227 rows.

After reloading GTFS data, refresh them:
```sql
REFRESH MATERIALIZED VIEW public.transit_routes;
REFRESH MATERIALIZED VIEW public.transit_stops;
```

Or run `sql/setup_views.sql` to rebuild from scratch.

### Realtime Tables

- **`realtime_vehicle_positions`** — Live vehicle points with bearing, speed, route, and next stop info
- **`realtime_vehicles_with_stops`** — View joining vehicle positions to stop names
- **`service_alerts`** — Active alerts, replaced every fetch cycle
- **`get_realtime_geojson()`** — SQL function serving the realtime GeoJSON layer

## Map Layers

The map has three toggleable source layers:

| Layer | Description |
|-------|-------------|
| **Rail lines** | LRT, MRT, Monorail, BRT, and KTMB Komuter routes |
| **Bus routes** | Rapid KL bus route lines |
| **MRT Feeder routes** | Feeder bus route lines (T-prefix routes) |
| **Stops** | All transit stops (filter by agency) |
| **Realtime vehicles** | Live vehicle positions (KTMB, Rapid Bus, MRT Feeder), 15s refresh |

Click any feature for a popup: routes show their name and agency, stops list serving
routes, and live vehicles show speed, destination, and next stop.

## Deployment

The included `deploy.sh` script builds the frontend then `rsync`s to the production server
over SSH port 55555:

```bash
./deploy.sh
```

Excludes source maps, dev config, `node_modules`, `.env`, and markdown files.

## Known Issues

- **KTMB** has stops displayed but **no route line geometry** — the route view unions rapid-* shapes only
- **Stop ID collision** — `transit_stops` uses `stop_id` as its identifier, but these are only unique within each feed. After the cross-agency UNION, IDs can collide
- **Realtime coverage** is upstream-dependent. Typically dominated by MRT feeder buses; Rapid KL bus and rail may be sparse or absent
- **`public.stop_times`** is an empty placeholder — real stop_times live in per-feed schemas as `interval`-typed columns

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit your changes (`git commit -m 'feat: add some feature'`)
4. Push to the branch (`git push origin feat/your-feature`)
5. Open a Pull Request

### Data Flow

To change what the map shows, follow this chain:

```
GTFS feed tables → sql/setup_views.sql → martin/martin.yaml → app/src constants
```

Update the relevant link in the chain, then refresh the materialized views.

## License

Licensed under the [GNU General Public License v3.0](LICENSE).

---

*Built with transit data from [data.gov.my](https://data.gov.my) and GTFS feeds for Klang Valley public transportation.*
