import { useState, useEffect } from 'react';

export function useRouteMetadata(map) {
  const [metadata, setMetadata] = useState({ routes: [], agencies: [] });

  useEffect(() => {
    if (!map) return;

    const updateMetadata = () => {
      const features = map.querySourceFeatures('routes', { sourceLayer: 'transit_routes' });
      if (!features.length) return;

      const seen = new Set();
      const routes = [];
      features.forEach(f => {
        const key = `${f.properties.agency}-${f.properties.route_short_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          routes.push({
            agency: f.properties.agency,
            shortName: f.properties.route_short_name,
            longName: f.properties.route_long_name,
            color: f.properties.route_color,
            routeId: f.properties.route_id
          });
        }
      });

      if (routes.length === 0) return;

      setMetadata(prev => {
        if (routes.length === prev.routes.length) return prev;
        return {
          routes: routes.sort((a, b) => a.agency.localeCompare(b.agency) || a.shortName.localeCompare(b.shortName)),
          agencies: [...new Set(routes.map(r => r.agency))]
        };
      });
    };

    map.on('idle', updateMetadata);
    return () => map.off('idle', updateMetadata);
  }, [map]);

  return metadata;
}
