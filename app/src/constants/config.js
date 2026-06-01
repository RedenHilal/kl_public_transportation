// Base URL of the Martin tile server (no trailing slash).
//
// Production (default): nginx proxies https://yuellen.my.id/martin -> martin:3000.
// Local dev: set VITE_MARTIN_URL=http://localhost:3000 in app/.env.development
//   (loaded by `npm run dev`; production `npm run build` ignores it, so the
//    deployed bundle keeps talking to the production tile server).
export const MARTIN_URL =
  import.meta.env.VITE_MARTIN_URL ?? 'https://yuellen.my.id/martin';

// Endpoint serving the whole live fleet as one GeoJSON FeatureCollection
// (the gtfs-realtime-fetcher's /realtime.geojson). Rendered as a single
// GeoJSON source so realtime vehicles stay consistent across zoom levels.
// Prod: nginx proxies this path to the fetcher; dev points at it directly
// via VITE_REALTIME_URL in app/.env.development.
export const REALTIME_URL =
  import.meta.env.VITE_REALTIME_URL ?? 'https://yuellen.my.id/realtime.geojson';

// Next-departures lookup for Rapid Rail stops (the fetcher's /arrivals endpoint;
// rail is frequency-based and has no live feed). Prod: nginx proxies this path to
// the fetcher; dev points at it directly via VITE_ARRIVALS_URL in .env.development.
export const ARRIVALS_URL =
  import.meta.env.VITE_ARRIVALS_URL ?? 'https://yuellen.my.id/arrivals';

// Full route geometry (GeoJSON) for a given agency+route, served by the fetcher.
// Used to animate live vehicles along the route line instead of straight-line.
export const ROUTE_URL =
  import.meta.env.VITE_ROUTE_URL ?? 'https://yuellen.my.id/route_geojson';
