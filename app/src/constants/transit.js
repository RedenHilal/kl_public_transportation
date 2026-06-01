import { railLineMatchExpr, busGroupMatchExpr, AGENCY_COLORS } from './colors';

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
    paint: { 'line-color': railLineMatchExpr(), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 6, 18, 11], 'line-opacity': 0.85 },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'bus-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-bus'],
    paint: { 'line-color': busGroupMatchExpr(), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 13, 3, 18, 6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'mrt-feeder-routes', type: 'line', source: 'routes', 'source-layer': 'transit_routes',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'],
    paint: { 'line-color': AGENCY_COLORS['rapid-mrt'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 13, 3, 18, 6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.2, 14, 0.5, 18, 0.8] },
    layout: { 'line-join': 'round', 'line-cap': 'round' } },
  { id: 'rail-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-rail'], minzoom: 11,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 6, 18, 9], 'circle-color': AGENCY_COLORS['rapid-rail'], 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
  { id: 'bus-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-bus'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 6, 18, 9], 'circle-color': AGENCY_COLORS['rapid-bus'], 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
  { id: 'mrt-feeder-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'rapid-mrt'], minzoom: 13,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 16, 6, 18, 9], 'circle-color': AGENCY_COLORS['rapid-mrt'], 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
  { id: 'ktmb-stops', type: 'circle', source: 'stops', 'source-layer': 'transit_stops',
    filter: ['==', ['get', 'agency'], 'ktmb'], minzoom: 11,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 6, 18, 9], 'circle-color': AGENCY_COLORS['ktmb'], 'circle-opacity': 0.85, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } },
];
