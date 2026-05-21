export const AGENCY_LABELS = {
  'ktmb': 'KTM',
  'rapid-rail': 'Rapid Rail',
  'rapid-bus': 'Rapid Bus',
  'rapid-mrt': 'MRT Feeder',
};

export const INTERACTIVE_LAYERS = [
  'rail-lines', 'bus-routes', 'mrt-feeder-routes',
  'rail-stops', 'bus-stops', 'mrt-feeder-stops', 'ktmb-stops',
  'realtime-ktmb', 'realtime-rapid-bus', 'realtime-mrt-feeder',
];

export const ASSET_MAP = [
  { id: "train", path: "train.png" },
  { id: "bus", path: "bus.png" },
  { id: "feeder", path: "feeder.png" }
];

export const LAYER_DEFS = [
  { id: 'rail-lines', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-rail'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#e57200'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 4, 18, 7], 'line-opacity': 0.85 },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'bus-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-bus'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#115740'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1.5, 18, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'mrt-feeder-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'],
    paint: { 'line-color': ['coalesce', ['get', 'route_color'], '#FFCD00'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 1.5, 18, 3], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'rail-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-rail'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 5, 18, 9], 'circle-color': '#D50032', 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
  { id: 'bus-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-bus'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 4, 18, 6], 'circle-color': '#2E8B57', 'circle-opacity': 0.6 } },
  { id: 'mrt-feeder-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 4, 18, 6], 'circle-color': '#DAA520', 'circle-opacity': 0.6 } },
  { id: 'ktmb-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'ktmb'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 5, 18, 9], 'circle-color': '#1964B7', 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
];
