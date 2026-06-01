import { useRef, useCallback } from 'react';
import { ROUTE_URL } from '../constants/config';
import { toParts } from '../utils/polyline';

// Lazily fetches and caches route geometry (parsed into polyline "parts") so live
// vehicles can be animated along their route line. `getParts(agency, route)`
// returns the cached parts or null, kicking off a one-time fetch when missing.
// KTMB has no geometry in transit_routes, so it simply stays null (linear glide).
export function useRouteGeometry() {
  const cache = useRef(new Map());   // key -> parts | null (resolved)
  const pending = useRef(new Set()); // keys currently being fetched

  const getParts = useCallback((agency, route) => {
    if (!agency || !route) return null;
    const key = `${agency}::${route}`;
    if (cache.current.has(key)) return cache.current.get(key);
    if (!pending.current.has(key)) {
      pending.current.add(key);
      fetch(`${ROUTE_URL}?agency=${encodeURIComponent(agency)}&route=${encodeURIComponent(route)}`)
        .then((r) => r.json())
        .then((geojson) => { cache.current.set(key, toParts(geojson)); })
        .catch(() => { cache.current.set(key, null); })
        .finally(() => { pending.current.delete(key); });
    }
    return null; // not ready yet — caller falls back to linear until it loads
  }, []);

  return getParts;
}
